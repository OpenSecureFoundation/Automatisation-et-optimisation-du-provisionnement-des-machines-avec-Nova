const { ResourceUsage } = require('../models');
const openstack = require('../config/openstack');
const gnocchi = require('./gnocchi');
const { getInstanceMetrics } = require('./ceilometer');
const { mergeSeriesByTimestamp, normalizeMetricValue } = require('./metricsContract');

async function getVmCapacity(vm, projectId) {
  try {
    // Les VMs en base peuvent avoir `flavorId` non renseigné.
    // On tente donc de le reconstruire à partir du serveur OpenStack.
    const serverData = await openstack.getServer(vm.instanceId, projectId);
    const server = serverData?.server ?? serverData;
    const flavorId = server?.flavor?.id ?? vm?.flavorId;
    if (!flavorId) return { ramMb: null, diskGb: null };

    const flavorData = await openstack.getFlavor(flavorId, projectId);
    const flavor = flavorData?.flavor ?? flavorData;
    return {
      ramMb: Number(flavor?.ram) || null,
      diskGb: Number(flavor?.disk) || null
    };
  } catch {
    return { ramMb: null, diskGb: null };
  }
}

function ensureMetricShape(byType) {
  const required = [
    'cpu_util',
    'memory_usage',
    'disk_usage',
    'network_incoming_bytes',
    'network_outgoing_bytes'
  ];
  for (const key of required) {
    if (!byType[key]) byType[key] = [];
  }
}

async function getMergedMetricsForVm(vm, projectId, options = {}) {
  const byType = {};
  const source = { primary: null, fallback: null };
  const capacity = await getVmCapacity(vm, projectId);

  const gnocchiMetrics = await gnocchi.getInstanceMetrics(vm.instanceId, projectId, { capacity });
  const hasGnocchi =
    !!(gnocchiMetrics &&
      Object.values(gnocchiMetrics).some(
        (s) => Array.isArray(s) && s.length > 0
      ));

  if (hasGnocchi) {
    source.primary = 'gnocchi';
    Object.assign(byType, gnocchiMetrics);
  } else {
    const ceilometerMetrics = await getInstanceMetrics(vm.instanceId, projectId);
    if (ceilometerMetrics && Object.keys(ceilometerMetrics).length) {
      source.primary = 'ceilometer';
      source.fallback = 'gnocchi_unavailable';
      for (const key of Object.keys(ceilometerMetrics)) {
        byType[key] = (ceilometerMetrics[key] || [])
          .map((point) => ({
            timestamp: point.timestamp,
            value: normalizeMetricValue(key, point.value, capacity)
          }))
          .filter((point) => point.value != null);
      }
    } else {
      source.primary = 'resource_usage_only';
    }
  }

  const usages = await ResourceUsage.findAll({
    where: { vmId: vm.id },
    order: [['timestamp', 'DESC']],
    limit: Number(options.dbLimit) || 100
  });
  const dbByType = {};
  for (const usage of usages) {
    if (!dbByType[usage.metricType]) dbByType[usage.metricType] = [];
    dbByType[usage.metricType].push({
      value: normalizeMetricValue(usage.metricType, usage.value, capacity),
      timestamp: usage.timestamp
    });
  }

  const allKeys = new Set([...Object.keys(byType), ...Object.keys(dbByType)]);
  for (const key of allKeys) {
    byType[key] = mergeSeriesByTimestamp(byType[key] || [], dbByType[key] || []);
  }

  ensureMetricShape(byType);
  return { metrics: byType, source };
}

async function getLatestMetricsForVm(vm, projectId) {
  const { metrics, source } = await getMergedMetricsForVm(vm, projectId, { dbLimit: 20 });
  const latest = {};
  for (const [key, series] of Object.entries(metrics)) {
    latest[key] = Array.isArray(series) && series.length ? series[0] : null;
  }
  return { latest, source };
}

module.exports = {
  getVmCapacity,
  getMergedMetricsForVm,
  getLatestMetricsForVm
};
