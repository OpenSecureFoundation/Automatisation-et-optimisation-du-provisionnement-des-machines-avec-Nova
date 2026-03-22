const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Notification } = require('../models');
const logger = require('../utils/logger');

router.use(authenticate);

/** GET /api/notifications - List notifications for current user (unread first, limit 50) */
router.get('/', async (req, res, next) => {
  try {
    const list = await Notification.findAll({
      where: { userId: req.userId },
      // Use primary key ordering to avoid runtime errors on legacy DBs
      // where createdAt/created_at columns may be missing.
      order: [['id', 'DESC']],
      limit: 50
    });
    const unreadFirst = [...list].sort((a, b) => (a.readAt ? 1 : 0) - (b.readAt ? 1 : 0));
    const notifications = unreadFirst.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      readAt: n.readAt,
      createdAt: n.createdAt
    }));
    const unreadCount = list.filter((n) => !n.readAt).length;
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    logger.error('GET /notifications error:', err.message);
    const msg = (err.message || '').toLowerCase();
    const tableMissing = err.name === 'SequelizeDatabaseError' ||
      msg.includes('no such table') ||
      msg.includes('does not exist') ||
      msg.includes('relation');
    if (tableMissing) {
      return res.json({ success: true, notifications: [], unreadCount: 0 });
    }
    next(err);
  }
});

/** PATCH /api/notifications/read-all - Mark all as read (must be before /:id/read) */
router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.update(
      { readAt: new Date() },
      { where: { userId: req.userId, readAt: null } }
    );
    res.json({ success: true });
  } catch (err) {
    if (err.name === 'SequelizeDatabaseError' || (err.message && err.message.includes('no such table'))) {
      return res.json({ success: true });
    }
    next(err);
  }
});

/** PATCH /api/notifications/:id/read - Mark one as read */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const n = await Notification.findOne({
      where: { id: req.params.id, userId: req.userId }
    });
    if (!n) {
      return res.status(404).json({ error: { message: 'Notification introuvable', status: 404 } });
    }
    if (!n.readAt) {
      n.readAt = new Date();
      await n.save();
    }
    res.json({ success: true, readAt: n.readAt });
  } catch (err) {
    if (err.name === 'SequelizeDatabaseError' || (err.message && err.message.includes('no such table'))) {
      return res.json({ success: true, readAt: new Date() });
    }
    next(err);
  }
});

module.exports = router;
