const { Op } = require('sequelize');
const VM = require('../models/VM');
const User = require('../models/User');
const ResourceUsage = require('../models/ResourceUsage');
const openstack = require('../config/openstack');
const gnocchi = require('./gnocchi');
const { normalizeMetricValue } = require('./metricsContract');

const { MetricsMonitor } = require('./metricsMonitor');
const { AutoScaler } = require('./autoScaler');

const monitor = new MetricsMonitor();
monitor.attach(new AutoScaler());
console.log('[metricsCollector] AutoScaler attache');



const DEFAULT_INTERVAL_MS = 30000; // 30 secondes

async function insertMetric(vmId, metricType, value, timestamp) {
  if (value == null || Number.isNaN(Number(value))) return;
  await ResourceUsage.create({ vmId, metricType, value: Number(value), timestamp });
}

async function getVmCapacity(vm, projectId) {
  try {
    const data = await openstack.getServer(vm.instanceId, projectId);
    const server = data?.server ?? data;
    const flavorId = server?.flavor?.id ?? vm.flavorId;
    if (!flavorId) return { ramMb: null, diskGb: null };
    const flavorData = await openstack.getFlavor(flavorId, projectId);
    const flavor = flavorData?.flavor ?? flavorData;
    return { ramMb: Number(flavor?.ram) || null, diskGb: Number(flavor?.disk) || null };
  } catch {
    return { ramMb: null, diskGb: null };
  }
}

async function collectFromGnocchi(vm) {
  const instanceId = vm.instanceId || vm.openstack_id;
  if (!instanceId) return false;
  const projectId = vm.User?.openstackProjectId || null;
  const capacity  = await getVmCapacity(vm, projectId);
  const metrics   = await gnocchi.getInstanceMetrics(instanceId, projectId, { capacity });
  if (!metrics) return false;

  const hasAnySeries = Object.values(metrics).some(s => Array.isArray(s) && s.length > 0);
  if (!hasAnySeries) return false;

  const ts = new Date();
  if (metrics.cpu_util?.length)              await insertMetric(vm.id, 'cpu_util',              metrics.cpu_util[metrics.cpu_util.length - 1].value,              metrics.cpu_util[metrics.cpu_util.length - 1].timestamp || ts);
  if (metrics.memory_usage?.length)          await insertMetric(vm.id, 'memory_usage',          metrics.memory_usage[metrics.memory_usage.length - 1].value,          metrics.memory_usage[metrics.memory_usage.length - 1].timestamp || ts);
  if (metrics.disk_usage?.length)            await insertMetric(vm.id, 'disk_usage',            metrics.disk_usage[metrics.disk_usage.length - 1].value,            metrics.disk_usage[metrics.disk_usage.length - 1].timestamp || ts);
  if (metrics.network_incoming_bytes?.length) await insertMetric(vm.id, 'network_incoming_bytes', metrics.network_incoming_bytes[metrics.network_incoming_bytes.length - 1].value, metrics.network_incoming_bytes[metrics.network_incoming_bytes.length - 1].timestamp || ts);
  if (metrics.network_outgoing_bytes?.length) await insertMetric(vm.id, 'network_outgoing_bytes', metrics.network_outgoing_bytes[metrics.network_outgoing_bytes.length - 1].value, metrics.network_outgoing_bytes[metrics.network_outgoing_bytes.length - 1].timestamp || ts);

  return true;
}

/**
 * Heuristiques de repli quand Gnocchi/Ceilometer ne sont pas disponibles.
 * Toutes les valeurs CPU/mem/disk sont stockées en % (0-100).
 * Valeurs réseau en bytes/s estimatifs.
 */
async function collectFallbackHeuristics(vm) {
  const instanceId = vm.instanceId || vm.openstack_id;
  if (!instanceId) return;
  const projectId = vm.User?.openstackProjectId || null;

  let data;
  try { data = await openstack.getServer(instanceId, projectId); } catch { return; }
  const instance = data?.server ?? data;
  if (!instance) return;

  const flavorId = instance.flavor?.id ?? vm.flavorId;
  if (!flavorId) return;

  let flavorData;
  try { flavorData = await openstack.getFlavor(flavorId, projectId); } catch { return; }
  const flavor = flavorData?.flavor ?? flavorData;
  if (!flavor) return;

  const isActive = (instance.status || '').toUpperCase() === 'ACTIVE';
  const ts = new Date();

  await Promise.all([
    insertMetric(vm.id, 'cpu_util',              isActive ? 10 : 0,   ts),
    insertMetric(vm.id, 'memory_usage',          isActive ? 35 : 5,   ts),
    insertMetric(vm.id, 'disk_usage',            15,                   ts),
    insertMetric(vm.id, 'network_incoming_bytes', isActive ? 1024 : 0, ts),
    insertMetric(vm.id, 'network_outgoing_bytes', isActive ? 512  : 0, ts),
  ]);
}

async function runOnce() {
  try {
    // CORRECTION: utiliser model: User (pas association: 'User') avec l'alias défini dans models/index.js
    const vms = await VM.findAll({
      where: { instanceId: { [Op.ne]: null } },
      include: [{ model: User, as: 'User', attributes: ['openstackProjectId'] }]
    });

    for (const vm of vms) {
      try {
        const usedGnocchi = await collectFromGnocchi(vm);
        if (!usedGnocchi) await collectFallbackHeuristics(vm);
      } catch (err) {
        console.error('[metricsCollector] VM error', vm.id, err.message);
      }
    }
    // Déclencher le scaling automatique
    try {
      await monitor.checkThresholds();
      console.log('[metricsCollector] checkThresholds OK', new Date().toISOString());
    } catch (err) {
      console.error('[metricsCollector] checkThresholds error:', err.message);
    }
  } catch (err) {
    console.error('[metricsCollector] runOnce failed:', err);
  }
}

function start(intervalMs = DEFAULT_INTERVAL_MS) {
  console.log('[metricsCollector] config:', JSON.stringify({
    intervalMs,
    GNOCCHI_URL: process.env.GNOCCHI_URL || null,
    CEILOMETER_URL: process.env.CEILOMETER_URL || null,
  }, null, 2));

  setTimeout(runOnce, 5000);
  setInterval(runOnce, intervalMs);
  console.log(`[metricsCollector] started (interval=${intervalMs}ms)`);
}

module.exports = { start, runOnce, monitor };
