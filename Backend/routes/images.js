const express = require('express');
const router = express.Router();
const openstack = require('../config/openstack');
const logger = require('../utils/logger');

// List all images (empty list if OpenStack unavailable)
router.get('/', async (req, res, next) => {
  try {
    logger.info('Images: list');
    const data = await openstack.listImages();
    
    // Filter and format images
    const images = (data.images || []).map(image => ({
      id: image.id,
      name: image.name,
      status: image.status,
      size: image.size,
      minDisk: image.minDisk || image.min_disk || 0,
      minRam: image.minRam || image.min_ram || 0,
      created: image.created || image.created_at,
      updated: image.updated || image.updated_at,
      visibility: image.visibility || 'public'
    }));

    res.json({
      success: true,
      count: images.length,
      images
    });
  } catch (error) {
    logger.error('Images list:', error.message);
    // OpenStack non disponible : renvoyer liste vide pour ne pas casser l'UI
    res.json({
      success: true,
      count: 0,
      images: [],
      _message: 'OpenStack non disponible (images vides)'
    });
  }
});

// Get specific image
router.get('/:id', async (req, res, next) => {
  try {
    const data = await openstack.getImage(req.params.id);
    res.json({
      success: true,
      image: data.image || data
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

