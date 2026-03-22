const express = require('express');
const router = express.Router();
const openstack = require('../config/openstack');
const logger = require('../utils/logger');

// Pricing configuration (en FCFA / mois)
const PRICING = {
  'm1.micro': 3000,
  'm1.tiny': 5000,
  'm1.small': 6000,
  'm1.medium': 15000,
  'm1.large': 30000,
  'm1.xlarge': 60000
};

// List all flavors with pricing (empty list if OpenStack unavailable)
router.get('/', async (req, res, next) => {
  try {
    logger.info('Flavors: list');
    const data = await openstack.listFlavors();
    
    // Add pricing information to flavors
    const flavorsWithPricing = (data.flavors || []).map(flavor => ({
      ...flavor,
      price: PRICING[flavor.name] || calculatePrice(flavor),
      currency: 'XAF',
      billing: 'monthly'
    }));

    res.json({
      success: true,
      count: flavorsWithPricing.length,
      flavors: flavorsWithPricing
    });
  } catch (error) {
    logger.error('Flavors list:', error.message);
    // OpenStack non disponible : renvoyer liste vide pour ne pas casser l'UI
    res.json({
      success: true,
      count: 0,
      flavors: [],
      _message: 'OpenStack non disponible (flavors vides)'
    });
  }
});

// Get specific flavor
router.get('/:id', async (req, res, next) => {
  try {
    const data = await openstack.getFlavor(req.params.id);
    const flavor = data.flavor;
    
    // Add pricing information
    flavor.price = PRICING[flavor.name] || calculatePrice(flavor);
    flavor.currency = 'XAF';
    flavor.billing = 'monthly';

    res.json({
      success: true,
      flavor
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to calculate price based on resources (en FCFA / mois)
function calculatePrice(flavor) {
  const ramGb = flavor.ram / 1024;
  const diskGb = flavor.disk;
  const vcpus = flavor.vcpus;
  // Formule simple : ~2 USD/vCPU + 3 USD/GB RAM + 0.10 USD/GB disque, converti en FCFA (1 USD ≈ 600 FCFA)
  const priceUsd = (vcpus * 2) + (ramGb * 3) + (diskGb * 0.10);
  return Math.ceil(priceUsd * 600);
}

module.exports = router;

