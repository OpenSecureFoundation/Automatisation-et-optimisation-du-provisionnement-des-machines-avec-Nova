const express = require('express');
const billingController = require('../controllers/billingController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', billingController.getPricingRules);
router.put('/', authenticate, requireRole('admin'), billingController.updatePricingRules);

module.exports = router;
