const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { User } = require('../models');
const { signToken } = require('../middleware/auth');
const openstack = require('../config/openstack');
const { createProject } = require('../services/keystoneSync');
const logger = require('../utils/logger');

// Clé secrète pour créer un compte admin (optionnelle — si non définie, rôle admin bloqué à l'inscription)
const ADMIN_REGISTRATION_SECRET = process.env.ADMIN_REGISTRATION_SECRET || null;

const register = async (req, res, next) => {
  logger.request('POST', '/api/auth/register', { email: req.body?.email, name: req.body?.name });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', status: 400, details: errors.array() } });
    }

    const { email, password, name, role, adminSecret } = req.body;

    // Sécurité : empêcher l'auto-promotion admin sans clé secrète
    let assignedRole = 'client';
    if (role === 'admin') {
      if (!ADMIN_REGISTRATION_SECRET) {
        // En dev sans variable configurée : autoriser pour faciliter les tests
        // En prod (NODE_ENV=production) : toujours bloquer
        if (process.env.NODE_ENV === 'production') {
          return res.status(403).json({
            error: { message: 'La création d\'un compte administrateur est désactivée en production.', status: 403 }
          });
        }
        assignedRole = 'admin'; // dev uniquement
      } else if (adminSecret !== ADMIN_REGISTRATION_SECRET) {
        return res.status(403).json({
          error: { message: 'Clé secrète admin incorrecte ou manquante.', status: 403 }
        });
      } else {
        assignedRole = 'admin';
      }
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: { message: 'Email already registered', status: 409 } });
    }

    logger.info('Register: creating user', email, 'role:', assignedRole);
    const user = await User.create({
      email: email.toLowerCase(),
      name: name || null,
      role: assignedRole,
      passwordHash: password
    });

    if (process.env.KEYSTONE_MULTI_TENANT === 'true') {
      try {
        const adminToken = await openstack.getAuthToken();
        const projectName = `vm-user-${user.id.replace(/-/g, '')}`.slice(0, 64);
        const projectId = await createProject(projectName, adminToken);
        if (projectId) {
          await user.update({ openstackProjectId: projectId });
          logger.info('Register: Keystone project created', projectId);
        }
      } catch (e) {
        logger.warn('Register: Keystone project creation skipped', e.message);
      }
    }

    const token = signToken(user);
    logger.info('Register: success', user.id, email);
    res.status(201).json({
      success: true,
      message: 'User registered',
      user: user.toJSON(),
      token,
      expiresIn: '24h'
    });
  } catch (err) {
    logger.error('Register: exception', err.message, err.stack);
    next(err);
  }
};

const login = async (req, res, next) => {
  logger.request('POST', '/api/auth/login', { email: req.body?.email });
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', status: 400, details: errors.array() } });
    }

    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: { message: 'Invalid email or password', status: 401 } });
    }
    if (user.isActive === false) {
      return res.status(403).json({ error: { message: 'Compte désactivé. Contactez l\'administrateur.', status: 403 } });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: { message: 'Invalid email or password', status: 401 } });
    }

    const token = signToken(user);
    logger.info('Login: success', user.id, email);
    res.json({ success: true, user: user.toJSON(), token, expiresIn: '24h' });
  } catch (err) {
    logger.error('Login: exception', err.message, err.stack);
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: { message: 'Not authenticated', status: 401 } });
    res.json({ success: true, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out (client should discard token)' });
};

const changePassword = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { message: 'Validation failed', status: 400, details: errors.array() } });
    }

    const user = req.user;
    if (!user) return res.status(401).json({ error: { message: 'Not authenticated', status: 401 } });

    const { currentPassword, newPassword } = req.body;
    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ error: { message: 'Mot de passe actuel incorrect', status: 401 } });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await user.update({ passwordHash });
    logger.info('Change password: success', user.id);
    res.json({ success: true, message: 'Mot de passe modifié.' });
  } catch (err) {
    logger.error('Change password: exception', err.message, err.stack);
    next(err);
  }
};

module.exports = { register, login, me, logout, changePassword };
