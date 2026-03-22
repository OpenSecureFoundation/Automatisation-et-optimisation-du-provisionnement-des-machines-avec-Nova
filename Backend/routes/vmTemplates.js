const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { VMTemplate } = require('../models');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const list = await VMTemplate.findAll({ order: [['name', 'ASC']] });
    res.json({
      success: true,
      templates: list.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        flavorId: t.flavorId,
        imageId: t.imageId
      }))
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
