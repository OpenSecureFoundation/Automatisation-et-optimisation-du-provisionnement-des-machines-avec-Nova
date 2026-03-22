const jwt = require('jsonwebtoken');
const { User } = require('../models');

const RAW_JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-use-long-random-string';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production-use-long-random-string')) {
  // En production, refuser de démarrer avec un secret faible ou par défaut
  // eslint-disable-next-line no-console
  console.error('[AUTH] JWT_SECRET must be set to a strong random value in production.');
  throw new Error('JWT_SECRET is not configured for production');
}

const JWT_SECRET = RAW_JWT_SECRET;

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
    const token = headerToken || queryToken;

    if (!token) {
      return res.status(401).json({
        error: { message: 'Authentication required', status: 401 }
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.sub);
    if (!user) {
      return res.status(401).json({
        error: { message: 'User not found', status: 401 }
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: { message: 'Account disabled. Please contact support.', status: 403 }
      });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { message: 'Token expired', status: 401 }
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: { message: 'Invalid token', status: 401 }
      });
    }
    next(err);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
    const token = headerToken || queryToken;
    if (!token) {
      return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.sub);
    if (user) {
      req.user = user;
      req.userId = user.id;
    }
    next();
  } catch {
    next();
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { message: 'Authentication required', status: 401 }
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: { message: 'Insufficient permissions', status: 403 }
      });
    }
    next();
  };
};

const signToken = (user, expiresIn = '24h') => {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn }
  );
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  signToken,
  JWT_SECRET
};
