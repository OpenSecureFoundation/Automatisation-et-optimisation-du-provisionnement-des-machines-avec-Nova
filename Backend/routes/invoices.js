const express = require('express');
const billingController = require('../controllers/billingController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, billingController.listInvoices);
router.post('/', authenticate, billingController.createInvoice);
router.get('/preferences', authenticate, billingController.getBillingPreferences);
router.put('/preferences', authenticate, billingController.updateBillingPreferences);
router.get('/:id', authenticate, billingController.getInvoice);
router.get('/:id/download', authenticate, billingController.downloadInvoice);
router.post('/:id/pay', authenticate, billingController.payInvoice);

module.exports = router;
