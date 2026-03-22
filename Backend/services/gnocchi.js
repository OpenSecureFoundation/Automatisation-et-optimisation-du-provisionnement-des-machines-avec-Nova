const axios = require('axios');
const openstack = require('../config/openstack');
const { normalizeMetricValue } = require('./metricsContract');

/**
 * Service d'accès à Gnocchi.
 *
 * Objectif: retourner une structure proche de celle de ceilometer.js:
 * {
 *   cpu_util: [{ value, timestamp }, ...],
 *   memory_usage: [{ value, timestamp }, ...],
 *   disk_usage: [...],
 *   network_incoming_bytes: [...],
 *   network_outgoing_bytes: [...]
 * }
 *
 * Remarque: l'API Gnocchi peut varier selon le déploiement; ce module
 * centralise la logique pour permettre d'ajuster facilement les endpoints
 * si besoin, sans impacter le reste du backend.
 */

const GNOCCHI_URL = process.env.GNOCCHI_URL || '';
const GNOCCHI_TIMEOUT_MS = Number(process.env.GNOCCHI_TIMEOUT_MS || 12000);
const GNOCCHI_RETRIES = Number(process.env.GNOCCHI_RETRIES || 1);
const GNOCCHI_ERROR_THROTTLE_MS = Number(process.env.GNOCCHI_ERROR_THROTTLE_MS || 60000);
const gnocchiHttp = axios.create({ timeout: GNOCCHI_TIMEOUT_MS });
const lastMetricErrorLog = new Map();

console.log('[gnocchi] config (redacted):', JSON.stringify({
  GNOCCHI_URL: GNOCCHI_URL || null,
  GNOCCHI_TIMEOUT_MS,
  GNOCCHI_RETRIES,
  GNOCCHI_ERROR_THROTTLE_MS
}, null, 2));

function logMetricErrorThrottled(metricName, err) {
  const key = `${metricName}:${err?.code || err?.response?.status || err?.message || 'unknown'}`;
  const now = Date.now();
  const last = lastMetricErrorLog.get(key) || 0;
  if (now - last < GNOCCHI_ERROR_THROTTLE_MS) return;
  lastMetricErrorLog.set(key, now);
  // eslint-disable-next-line no-console
  console.error('[gnocchi] metric error', metricName, err.message);
}

function isRetryableGnocchiError(err) {
  if (!err) return false;
  if (['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT'].includes(err.code)) return true;
  const status = err.response?.status;
  return [500, 502, 503, 504].includes(status);
}

async function getWithRetry(url, config) {
  let attempt = 0;
  while (true) {
    try {
      return await gnocchiHttp.get(url, config);
    } catch (err) {
      const shouldRetry = attempt < GNOCCHI_RETRIES && isRetryableGnocchiError(err);
      if (!shouldRetry) throw err;
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}

function toSeries(measures) {
  if (!Array.isArray(measures)) return [];
  // Format attendu: [[timestamp, granularity, value], ...]
  return measures
    .map((m) => {
      if (!Array.isArray(m) || m.length < 3) return null;
      const [ts, , val] = m;
      return {
        value: Number(val ?? 0),
        timestamp: ts
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function getMetricIdForResource(metricName, resourceId, token) {
  // On essaye d'abord la convention \"metric par nom\" sur la ressource
  // /v1/metric?sort=name:asc&filter=...
  const url = `${GNOCCHI_URL}/v1/metric`;
  const filter = {
    and: [
      { '=': { name: metricName } },
      { '=': { 'resource_id': resourceId } }
    ]
  };
  const params = {
    sort: 'name:asc',
    filter: JSON.stringify(filter)
  };
  const res = await getWithRetry(url, {
    headers: { 'X-Auth-Token': token },
    params
  });
  const list = Array.isArray(res.data) ? res.data : [];
  if (!list.length) return null;
  return list[0].id || list[0].metric_id || null;
}

async function getMeasures(metricId, token, options = {}) {
  if (!metricId) return [];
  const url = `${GNOCCHI_URL}/v1/metric/${encodeURIComponent(metricId)}/measures`;
  const params = {};
  if (options.granularity) params.granularity = options.granularity;
  if (options.limit) params.limit = options.limit;
  if (options.start) params.start = options.start;
  if (options.stop) params.stop = options.stop;
  const res = await getWithRetry(url, {
    headers: { 'X-Auth-Token': token },
    params
  });
  return toSeries(res.data);
}

/**
 * Retourne les métriques d'une instance Nova depuis Gnocchi.
 * @param {string} resourceId - UUID du serveur Nova (instanceId)
 * @param {string|null} projectId - éventuel scope projet Keystone
 */
async function getInstanceMetrics(resourceId, projectId = null, options = {}) {
  if (!GNOCCHI_URL) {
    return null;
  }
  if (!resourceId) return null;
  try {
    const token = await openstack.getAuthToken(projectId);
    const limit = 60;
    const ops = [
      { name: 'cpu_util', gnocchiName: 'cpu_util' },
      { name: 'memory_usage', gnocchiName: 'memory.usage' },
      { name: 'disk_usage', gnocchiName: 'disk.usage' },
      { name: 'network_incoming_bytes', gnocchiName: 'network.incoming.bytes' },
      { name: 'network_outgoing_bytes', gnocchiName: 'network.outgoing.bytes' }
    ];

    const results = {};
    const capacity = options.capacity || {};
    for (const m of ops) {
      try {
        const metricId = await getMetricIdForResource(m.gnocchiName, resourceId, token);
        if (!metricId) continue;
        const series = await getMeasures(metricId, token, { limit });
        const normalizedSeries = series
          .map((point) => ({
            timestamp: point.timestamp,
            value: normalizeMetricValue(m.name, point.value, capacity)
          }))
          .filter((point) => point.value != null);
        if (normalizedSeries.length) {
          results[m.name] = normalizedSeries;
        }
      } catch (err) {
        // On logge de façon limitée pour éviter le flood en cas de panne Gnocchi.
        logMetricErrorThrottled(m.name, err);
      }
    }

    if (!Object.keys(results).length) {
      return null;
    }
    return results;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gnocchi] getInstanceMetrics failed', err.message);
    return null;
  }
}

module.exports = {
  getInstanceMetrics
};

