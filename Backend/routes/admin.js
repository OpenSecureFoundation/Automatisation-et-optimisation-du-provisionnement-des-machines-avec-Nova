const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { VMTemplate, GlobalScaleUpRule, User } = require('../models');
const adminController = require('../controllers/adminController');
const billingController = require('../controllers/billingController');

router.use(authenticate);
router.use(requireRole('admin'));

// ── VM Templates ──
router.get('/vm-templates', async (req, res, next) => {
  try {
    const list = await VMTemplate.findAll({ order: [['name', 'ASC']] });
    res.json({
      success: true,
      templates: list.map(t => ({ id: t.id, name: t.name, description: t.description, flavorId: t.flavorId, imageId: t.imageId }))
    });
  } catch (err) { next(err); }
});

router.post('/vm-templates', async (req, res, next) => {
  try {
    const { name, description, flavorId, imageId } = req.body;

    // Validation renforcée
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return res.status(400).json({ error: { message: 'name est requis et ne peut pas être vide.', status: 400 } });
    if (cleanName.length > 120) return res.status(400).json({ error: { message: 'name trop long (max 120 caractères).', status: 400 } });
    if (!flavorId || typeof flavorId !== 'string' || !flavorId.trim()) return res.status(400).json({ error: { message: 'flavorId est requis.', status: 400 } });
    if (!imageId  || typeof imageId  !== 'string' || !imageId.trim())  return res.status(400).json({ error: { message: 'imageId est requis.', status: 400 } });

    const t = await VMTemplate.create({
      name: cleanName,
      description: description ? String(description).trim().slice(0, 255) : null,
      flavorId: flavorId.trim(),
      imageId:  imageId.trim()
    });
    res.status(201).json({ success: true, template: { id: t.id, name: t.name, description: t.description, flavorId: t.flavorId, imageId: t.imageId } });
  } catch (err) { next(err); }
});

router.get('/vm-templates/:id', async (req, res, next) => {
  try {
    const t = await VMTemplate.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: { message: 'Template not found', status: 404 } });
    res.json({ success: true, template: { id: t.id, name: t.name, description: t.description, flavorId: t.flavorId, imageId: t.imageId } });
  } catch (err) { next(err); }
});

router.put('/vm-templates/:id', async (req, res, next) => {
  try {
    const t = await VMTemplate.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: { message: 'Template not found', status: 404 } });
    const { name, description, flavorId, imageId } = req.body;

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) return res.status(400).json({ error: { message: 'name ne peut pas être vide.', status: 400 } });
      t.name = cleanName.slice(0, 120);
    }
    if (description !== undefined) t.description = description ? String(description).trim().slice(0, 255) : null;
    if (flavorId !== undefined) {
      if (!flavorId || !String(flavorId).trim()) return res.status(400).json({ error: { message: 'flavorId invalide.', status: 400 } });
      t.flavorId = String(flavorId).trim();
    }
    if (imageId !== undefined) {
      if (!imageId || !String(imageId).trim()) return res.status(400).json({ error: { message: 'imageId invalide.', status: 400 } });
      t.imageId = String(imageId).trim();
    }
    await t.save();
    res.json({ success: true, template: { id: t.id, name: t.name, description: t.description, flavorId: t.flavorId, imageId: t.imageId } });
  } catch (err) { next(err); }
});

router.delete('/vm-templates/:id', async (req, res, next) => {
  try {
    const t = await VMTemplate.findByPk(req.params.id);
    if (!t) return res.status(404).json({ error: { message: 'Template not found', status: 404 } });
    await t.destroy();
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
});

// ── Stats ──
router.get('/stats', adminController.getStats);

// ── VMs ──
router.get('/vms',              adminController.listAllVms);
router.get('/vms/:id',          adminController.getVmDetail);
router.get('/vms/:id/console',  adminController.getVmConsole);
router.post('/vms/:id/action',  adminController.vmAction);
router.delete('/vms/:id',       adminController.deleteVm);
router.get('/metrics/latest',   adminController.getLatestMetricsSnapshot);

// ── Users ──
router.get('/users',       adminController.listUsers);
router.patch('/users/:id', adminController.updateUser);

// ── Invoices ──
router.get('/invoices',                    billingController.listAdminInvoices);
router.get('/invoices/:id/download',       billingController.downloadAdminInvoice);
router.get('/invoices/:id',                billingController.getAdminInvoice);

// ── Scale-up rule ──
router.get('/scale-up-rule', async (req, res, next) => {
  try {
    const rule = await GlobalScaleUpRule.findOne({ where: { isActive: true } });
    if (!rule) return res.json({ success: true, rule: { deltaVcpus: 2, deltaRamMb: 4096, isActive: false } });
    res.json({ success: true, rule: { id: rule.id, deltaVcpus: rule.deltaVcpus, deltaRamMb: rule.deltaRamMb, isActive: rule.isActive } });
  } catch (err) { next(err); }
});

router.put('/scale-up-rule', async (req, res, next) => {
  try {
    const { deltaVcpus, deltaRamMb, isActive } = req.body;

    // Validation : delta doit être > 0
    if (deltaVcpus !== undefined && (isNaN(Number(deltaVcpus)) || Number(deltaVcpus) < 1)) {
      return res.status(400).json({ error: { message: 'deltaVcpus doit être un entier ≥ 1.', status: 400 } });
    }
    if (deltaRamMb !== undefined && (isNaN(Number(deltaRamMb)) || Number(deltaRamMb) < 512)) {
      return res.status(400).json({ error: { message: 'deltaRamMb doit être ≥ 512 MB.', status: 400 } });
    }

    let rule = await GlobalScaleUpRule.findOne({ order: [['createdAt', 'ASC']] });
    if (rule) {
      await rule.update({
        deltaVcpus: deltaVcpus !== undefined ? Number(deltaVcpus) : rule.deltaVcpus,
        deltaRamMb: deltaRamMb !== undefined ? Number(deltaRamMb) : rule.deltaRamMb,
        isActive: isActive !== undefined ? isActive : rule.isActive
      });
    } else {
      rule = await GlobalScaleUpRule.create({
        deltaVcpus: deltaVcpus !== undefined ? Number(deltaVcpus) : 2,
        deltaRamMb: deltaRamMb !== undefined ? Number(deltaRamMb) : 4096,
        isActive: isActive !== false
      });
    }
    res.json({ success: true, rule: { id: rule.id, deltaVcpus: rule.deltaVcpus, deltaRamMb: rule.deltaRamMb, isActive: rule.isActive } });
  } catch (err) { next(err); }
});

module.exports = router;
