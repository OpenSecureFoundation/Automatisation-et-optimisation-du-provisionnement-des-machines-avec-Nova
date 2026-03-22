const axios = require('axios');
const openstack = require('../config/openstack');

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.samples)) return data.samples;
  return [];
}

function samplesToSeries(samples) {
  return samples.map((s) => ({
    value: Number(s.counter_volume ?? s.volume ?? 0),
    timestamp: s.timestamp || s.recorded_at
  })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * @param {string} resourceId - Nova server UUID (instance id)
 * @param {string} [projectId] - Optional Keystone project ID for token scope
 * @returns {Promise<Object>}
 */
async function getInstanceMetrics(resourceId, projectId = null) {
  const baseUrl = process.env.CEILOMETER_URL;
  if (!baseUrl) return null;
  try {
    if (!getInstanceMetrics._loggedOnce) {
      getInstanceMetrics._loggedOnce = true;
      // eslint-disable-next-line no-console
      console.log('[ceilometer] config:', JSON.stringify({
        CEILOMETER_URL: baseUrl
      }, null, 2));
    }
    const token = await openstack.getAuthToken(projectId);
    const limit = 60;
    const q = `q.field=resource_id&q.op=eq&q.value=${resourceId}`;
    const meters = [
      'cpu_util',
      'memory.usage',
      'disk.usage',
      'network.incoming.bytes',
      'network.outgoing.bytes'
    ];
    const results = await Promise.all(
      meters.map((meter) =>
        axios.get(`${baseUrl}/v2/meters/${encodeURIComponent(meter)}?${q}&limit=${limit}`, {
          headers: { 'X-Auth-Token': token }
        }).catch(() => ({ data: [] }))
      )
    );
    const cpuSamples = toArray(results[0].data);
    const memSamples = toArray(results[1].data);
    const diskSamples = toArray(results[2].data);
    const netInSamples = toArray(results[3].data);
    const netOutSamples = toArray(results[4].data);

    const out = {
      cpu_util: samplesToSeries(cpuSamples),
      memory_usage: samplesToSeries(memSamples)
    };
    if (diskSamples.length) out.disk_usage = samplesToSeries(diskSamples);
    if (netInSamples.length) out.network_incoming_bytes = samplesToSeries(netInSamples);
    if (netOutSamples.length) out.network_outgoing_bytes = samplesToSeries(netOutSamples);
    return out;
  } catch (err) {
    return null;
  }
}

module.exports = { getInstanceMetrics };
