const express = require('express');
const router = express.Router();
const openstack = require('../config/openstack');
const logger = require('../utils/logger');

// Get OpenStack connection status
router.get('/status', async (req, res, next) => {
  try {
    logger.info('OpenStack: get status');
    const health = await openstack.getServiceHealth();
    res.json({
      success: true,
      connected: !!health.overall,
      message: health.overall ? 'Successfully connected to OpenStack' : 'OpenStack partially unavailable',
      timestamp: new Date().toISOString(),
      services: health
    });
  } catch (error) {
    logger.error('OpenStack status:', error.message);
    res.status(503).json({
      success: false,
      connected: false,
      message: 'Failed to connect to OpenStack',
      error: error.message
    });
  }
});

// Detailed health endpoint for diagnostics
router.get('/health', async (req, res, next) => {
  try {
    logger.info('OpenStack: health check');
    const health = await openstack.getServiceHealth();
    res.status(health.overall ? 200 : 503).json({
      success: health.overall,
      connected: health.overall,
      services: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('OpenStack health:', error.message);
    next(error);
  }
});

// Get networks
router.get('/networks', async (req, res, next) => {
  try {
    logger.info('OpenStack: list networks');
    const data = await openstack.listNetworks();
    res.json({
      success: true,
      networks: data.networks || []
    });
  } catch (error) {
    logger.error('OpenStack networks:', error.message);
    next(error);
  }
});

// Get floating IPs
router.get('/floatingips', async (req, res, next) => {
  try {
    logger.info('OpenStack: list floatingips');
    const data = await openstack.listFloatingIPs();
    res.json({
      success: true,
      floatingips: data.floatingips || []
    });
  } catch (error) {
    logger.error('OpenStack floatingips:', error.message);
    next(error);
  }
});

module.exports = router;

