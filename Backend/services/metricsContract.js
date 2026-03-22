function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampPercent(value) {
  const n = toNumber(value);
  if (n == null) return null;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function normalizeCpuUtil(rawValue) {
  const raw = toNumber(rawValue);
  if (raw == null) return null;
  if (raw < 0) return null;

  // Heuristiques:
  // - 0..1 => fraction => *100
  // - 0..100 => pourcentage
  // - 0..10000 => basis points => /100
  // - au-delà: valeurs incohérentes (ex: bytes/cores), on ne force pas à 100%
  if (raw <= 1) return clampPercent(raw * 100);
  if (raw <= 100) return clampPercent(raw);
  if (raw <= 10000) return clampPercent(raw / 100);
  return null;
}

function normalizeMemoryUsage(rawValue, ramMb) {
  const raw = toNumber(rawValue);
  if (raw == null) return null;
  if (raw <= 1) return clampPercent(raw * 100);
  if (raw <= 100) return clampPercent(raw);
  const totalRamMb = toNumber(ramMb);
  if (!totalRamMb || totalRamMb <= 0) return null;
  const usedMb = raw > totalRamMb * 2 ? raw / (1024 * 1024) : raw;
  return clampPercent((usedMb / totalRamMb) * 100);
}

function normalizeDiskUsage(rawValue, diskGb) {
  const raw = toNumber(rawValue);
  if (raw == null) return null;
  if (raw <= 1) return clampPercent(raw * 100);
  if (raw <= 100) return clampPercent(raw);
  const totalDiskGb = toNumber(diskGb);
  if (!totalDiskGb || totalDiskGb <= 0) return null;

  // Heuristics: most OpenStack metrics are bytes; keep MB fallback for some deployments.
  const usedGb = raw > totalDiskGb * 2048 ? raw / (1024 * 1024 * 1024) : raw / 1024;
  return clampPercent((usedGb / totalDiskGb) * 100);
}

function normalizeMetricValue(metricType, rawValue, capacity = {}) {
  switch (metricType) {
    case 'cpu_util':
      return normalizeCpuUtil(rawValue);
    case 'memory_usage':
      return normalizeMemoryUsage(rawValue, capacity.ramMb);
    case 'disk_usage':
      return normalizeDiskUsage(rawValue, capacity.diskGb);
    case 'network_incoming_bytes':
    case 'network_outgoing_bytes':
      return toNumber(rawValue);
    default:
      return toNumber(rawValue);
  }
}

function mergeSeriesByTimestamp(primarySeries = [], secondarySeries = []) {
  const map = new Map();
  const add = (entry, source) => {
    if (!entry || !entry.timestamp) return;
    const ts = new Date(entry.timestamp).toISOString();
    if (!map.has(ts)) {
      map.set(ts, {
        value: toNumber(entry.value),
        timestamp: ts,
        source
      });
    }
  };
  primarySeries.forEach((e) => add(e, 'live'));
  secondarySeries.forEach((e) => add(e, 'db'));
  return Array.from(map.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = {
  toNumber,
  clampPercent,
  normalizeCpuUtil,
  normalizeMemoryUsage,
  normalizeDiskUsage,
  normalizeMetricValue,
  mergeSeriesByTimestamp
};
