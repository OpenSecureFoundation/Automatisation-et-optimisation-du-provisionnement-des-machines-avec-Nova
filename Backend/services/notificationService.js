const { Notification } = require('../models');

/**
 * Create an in-app notification for a user.
 * @param {string} userId - User UUID
 * @param {object} opts - { type, title, message, link }
 */
async function createNotification(userId, opts = {}) {
  if (!userId) return null;
  const { type = 'info', title = '', message = '', link = null } = opts;
  try {
    const n = await Notification.create({
      userId,
      type: String(type).slice(0, 64),
      title: String(title).slice(0, 255),
      message: message ? String(message) : null,
      link: link ? String(link).slice(0, 512) : null
    });
    return n;
  } catch (err) {
    console.error('[Notification] create error:', err.message);
    return null;
  }
}

module.exports = { createNotification };
