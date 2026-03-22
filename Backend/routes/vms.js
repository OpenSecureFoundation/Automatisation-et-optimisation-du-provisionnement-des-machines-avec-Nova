const express = require('express');
const router = express.Router();
const openstack = require('../config/openstack');
const scalingController = require('../controllers/scalingController');
const { authenticate } = require('../middleware/auth');
const { VM, VmRuntime, VMTemplate, ScalingPolicy, User } = require('../models');
const vmService = require('../services/vmService');
const metricsQueryService = require('../services/metricsQueryService');
const logger = require('../utils/logger');

// Helper include User avec alias
const includeUser = { model: User, as: 'User', attributes: ['openstackProjectId'] };

async function findFlavorBySpecs(vcpus, ramGb, diskGb) {
  const data = await openstack.listFlavors();
  const flavors = (data.flavors || []).slice();
  const ramMb = Math.ceil((ramGb || 0) * 1024) || 512;
  const needVcpus = vcpus || 1;
  const needDisk  = diskGb || 20;
  const candidates = flavors.filter(f => (f.vcpus||0) >= needVcpus && (f.ram||0) >= ramMb && (f.disk||0) >= needDisk);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a.vcpus * 1024 + a.ram) - (b.vcpus * 1024 + b.ram));
  return candidates[0];
}

router.use(authenticate);

async function findVmByParam(paramId, userId) {
  const vm = await vmService.findVmForUser(paramId, userId);
  if (vm) return vm;
  return null;
}

const normalizeVmParam = vmService.normalizeVmParam;

// ── GET / ──
router.get('/', async (req, res, next) => {
  try {
    const vms = await VM.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']]
    });
    const servers = await Promise.all(vms.map(vm => {
      const projectId = req.user?.openstackProjectId || null;
      return vmService.buildServerView(vm, projectId);
    }));
    res.json({ success: true, count: servers.length, servers });
  } catch (error) {
    next(error);
  }
});

// ── Console by DB id ──
router.get('/console/by-db-id/:dbId', async (req, res, next) => {
  const dbId = normalizeVmParam(req.params.dbId);
  try {
    if (!dbId) return res.status(400).json({ error: { message: 'dbId required', status: 400 } });
    const vm = await VM.findOne({ where: { id: dbId, userId: req.userId } });
    if (!vm) return res.status(404).json({ error: { message: 'VM introuvable ou accès non autorisé.', status: 404, code: 'VM_NOT_FOUND' } });

    const projectId = req.user?.openstackProjectId || null;
    let url;
    try { url = await openstack.getConsoleUrl(vm.instanceId, projectId); }
    catch (osErr) {
      if (osErr.response?.status === 404) return res.status(503).json({ error: { message: 'Console non disponible.', status: 503, code: 'CONSOLE_UNAVAILABLE' } });
      throw osErr;
    }
    if (!url) return res.status(503).json({ error: { message: 'Console non disponible.', status: 503 } });
    res.json({ success: true, url });
  } catch (error) { next(error); }
});

// ── Scaling ──
router.get('/:id/scaling-policy',   scalingController.getScalingPolicy);
router.put('/:id/scaling-policy',   scalingController.putScalingPolicy);

router.get('/:id/metrics/latest', async (req, res, next) => {
  try {
    const vm = await findVmByParam(req.params.id, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    const projectId = req.user?.openstackProjectId || null;
    const { latest, source } = await metricsQueryService.getLatestMetricsForVm(vm, projectId);
    res.json({ success: true, instanceId: vm.instanceId, latest, source });
  } catch (error) { next(error); }
});

router.get('/:id/metrics/stream', async (req, res, next) => {
  try {
    const vm = await findVmByParam(req.params.id, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    const projectId = req.user?.openstackProjectId || null;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendLatest = async () => {
      const { latest, source } = await metricsQueryService.getLatestMetricsForVm(vm, projectId);
      res.write(`event: metrics\n`);
      res.write(`data: ${JSON.stringify({ instanceId: vm.instanceId, latest, source, ts: new Date().toISOString() })}\n\n`);
    };
    await sendLatest();
    const interval = setInterval(() => sendLatest().catch(() => {}), Number(process.env.METRICS_STREAM_INTERVAL_MS || 10000));
    req.on('close', () => { clearInterval(interval); res.end(); });
  } catch (error) { next(error); }
});

router.get('/:id/metrics',         scalingController.getMetrics);
router.get('/:id/scaling-history', scalingController.getScalingHistory);

// ── Console ──
router.get('/:id/console', async (req, res, next) => {
  const paramId = normalizeVmParam(req.params.id);
  try {
    const vm = await findVmByParam(paramId, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM introuvable.', status: 404, code: 'VM_NOT_FOUND' } });
    const projectId = req.user?.openstackProjectId || null;
    let url;
    try { url = await openstack.getConsoleUrl(vm.instanceId, projectId); }
    catch (osErr) {
      if (osErr.response?.status === 404) return res.status(503).json({ error: { message: 'Console non disponible.', status: 503, code: 'CONSOLE_UNAVAILABLE' } });
      throw osErr;
    }
    if (!url) return res.status(503).json({ error: { message: 'Console non disponible.', status: 503 } });
    res.json({ success: true, url });
  } catch (error) { next(error); }
});

// ── Snapshot ──
router.post('/:id/snapshot', async (req, res, next) => {
  const paramId = normalizeVmParam(req.params.id);
  const name = (req.body.name && String(req.body.name).trim()) || `snap-${Date.now()}`;
  try {
    const vm = await findVmByParam(paramId, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM introuvable', status: 404 } });
    if (!['ACTIVE', 'SHUTOFF'].includes(vm.status)) return res.status(400).json({ error: { message: 'La VM doit être active ou arrêtée pour créer un snapshot.', status: 400 } });
    const projectId = req.user?.openstackProjectId || null;
    const imageName = name.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || `snap-${Date.now()}`;
    await openstack.createImageFromServer(vm.instanceId, imageName, projectId);
    res.status(202).json({ success: true, message: 'Snapshot en cours de création.', imageName });
  } catch (err) {
    if (err.response?.status === 400) return res.status(400).json({ error: { message: err.response?.data?.error?.message || 'Impossible de créer le snapshot.', status: 400 } });
    next(err);
  }
});

// ── GET /:id ──
router.get('/:id', async (req, res, next) => {
  try {
    const vm = await findVmByParam(req.params.id, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    const projectId = req.user?.openstackProjectId || null;
    const server = await vmService.getDetailedServerView(vm, projectId, false);
    res.json({ success: true, server });
  } catch (error) { next(error); }
});

// ── POST / (créer VM) ──
router.post('/', async (req, res, next) => {
  try {
    const { name, templateId, flavorRef, imageRef, networkId, keyName, vcpus, ramGb, diskGb, scaling, userData, expiresAt } = req.body;

    // Validation du nom
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) {
      return res.status(400).json({ error: { message: 'Le nom de la VM est requis et ne peut pas être vide.', status: 400 } });
    }
    if (cleanName.length > 255) {
      return res.status(400).json({ error: { message: 'Le nom de la VM ne peut pas dépasser 255 caractères.', status: 400 } });
    }
    // Caractères autorisés par OpenStack Nova (lettres, chiffres, tirets, underscores, points)
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanName)) {
      return res.status(400).json({ error: { message: 'Le nom ne peut contenir que des lettres, chiffres, tirets, underscores et points.', status: 400 } });
    }

    let flavorIdToUse = flavorRef;
    let imageIdToUse  = imageRef;

    if (templateId) {
      const template = await VMTemplate.findByPk(templateId);
      if (!template) return res.status(400).json({ error: { message: 'Template not found', status: 400 } });
      flavorIdToUse = template.flavorId;
      imageIdToUse  = template.imageId;
    } else if (vcpus != null || ramGb != null || diskGb != null) {
      if (!imageRef) return res.status(400).json({ error: { message: 'imageRef is required for custom VM', status: 400 } });
      const flavor = await findFlavorBySpecs(vcpus ? Number(vcpus) : 1, ramGb ? Number(ramGb) : 1, diskGb ? Number(diskGb) : 20);
      if (!flavor) return res.status(400).json({ error: { message: 'No flavor matches the requested vCPU/RAM/disk', status: 400 } });
      flavorIdToUse = flavor.id;
      imageIdToUse  = imageRef;
    }

    if (!flavorIdToUse || !imageIdToUse) {
      return res.status(400).json({ error: { message: 'Provide templateId, or (flavorRef + imageRef), or (vcpus, ramGb, diskGb + imageRef)', status: 400 } });
    }

    const serverData = { name: cleanName, flavorRef: flavorIdToUse, imageRef: imageIdToUse, networks: networkId ? [{ uuid: networkId }] : 'auto' };
    if (keyName) serverData.key_name = keyName;
    if (userData && typeof userData === 'string') serverData.user_data = Buffer.from(userData, 'utf8').toString('base64');

    const projectId = req.user?.openstackProjectId || null;
    const data      = await openstack.createServer(serverData, projectId);
    const server    = data.server;
    const instanceId = typeof server.id === 'string' ? server.id : server.id?.id;

    const vmRecord = await VM.create({
      userId: req.userId,
      instanceId,
      name: server.name || cleanName,
      flavorId: flavorIdToUse,
      status: server.status || 'BUILD',
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    if (scaling && (scaling.thresholdHigh != null || scaling.thresholdLow != null)) {
      await ScalingPolicy.create({
        instanceId,
        metricType: scaling.metricType || 'cpu_and_memory',
        thresholdHigh: scaling.thresholdHigh ?? 80,
        thresholdLow:  scaling.thresholdLow  ?? 20,
        isActive: true,
        baseFlavorId: scaling.baseFlavorId || flavorIdToUse
      });
    }

    res.status(201).json({ success: true, message: 'VM created successfully', server: data.server });
  } catch (error) { next(error); }
});

// ── DELETE /:id ──
router.delete('/:id', async (req, res, next) => {
  try {
    const vm = await findVmByParam(req.params.id, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    const projectId = req.user?.openstackProjectId || null;
    try { await openstack.deleteServer(vm.instanceId, projectId); }
    catch (e) { if (e.response?.status !== 404) throw e; }
    const runtime = await VmRuntime.findOne({
      where: { instanceId: vm.instanceId, userId: req.userId, stoppedAt: null },
      order: [['startedAt', 'DESC']]
    });
    if (runtime) { runtime.stoppedAt = new Date(); await runtime.save(); }
    await vm.destroy();
    res.json({ success: true, message: 'VM deleted successfully' });
  } catch (error) { next(error); }
});

// ── POST /:id/action ──
router.post('/:id/action', async (req, res, next) => {
  try {
    const { action } = req.body;
    const vm = await findVmByParam(req.params.id, req.userId);
    if (!vm) return res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    const serverId = vm.instanceId;

    const actionMap = {
      start:   { 'os-start': null },
      stop:    { 'os-stop': null },
      reboot:  { reboot: { type: req.body.rebootType || 'SOFT' } },
      pause:   { pause: null },
      unpause: { unpause: null },
      suspend: { suspend: null },
      resume:  { resume: null }
    };
    const actionBody = actionMap[action];
    if (!actionBody) {
      return res.status(400).json({ error: { message: 'Invalid action. Valid: start, stop, reboot, pause, unpause, suspend, resume', status: 400 } });
    }

    const projectId = req.user?.openstackProjectId || null;
    try { await openstack.serverAction(serverId, actionBody, projectId); }
    catch (err) {
      if (err.response?.status === 409) {
        const msg = err.response?.data?.conflict?.message || err.response?.data?.message || 'Action impossible dans l\'état actuel de la VM.';
        return res.status(409).json({ error: { message: msg, status: 409, code: 'CONFLICT' } });
      }
      throw err;
    }

    // Runtime tracking
    if (['start', 'resume', 'unpause'].includes(action)) {
      const alreadyRunning = await VmRuntime.findOne({ where: { instanceId: serverId, userId: req.userId, stoppedAt: null } });
      if (!alreadyRunning) await VmRuntime.create({ instanceId: serverId, userId: req.userId, startedAt: new Date(), stoppedAt: null });
    } else if (['stop', 'suspend', 'pause'].includes(action)) {
      const runtime = await VmRuntime.findOne({ where: { instanceId: serverId, userId: req.userId, stoppedAt: null }, order: [['startedAt', 'DESC']] });
      if (runtime) { runtime.stoppedAt = new Date(); await runtime.save(); }
    }

    res.json({ success: true, message: `VM ${action} action executed successfully` });
  } catch (error) { next(error); }
});

module.exports = router;
