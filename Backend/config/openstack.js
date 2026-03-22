const axios = require('axios');
const logger = require('../utils/logger');

// Éviter de spammer les logs quand OpenStack est indisponible (une fois par minute par type)
const lastConnectionErrorLog = { nova: 0, neutron: 0, glance: 0, keystone: 0 };
const THROTTLE_MS = 60 * 1000;
const CACHE_TTL_MS = Number(process.env.OPENSTACK_CACHE_TTL_MS || 30 * 1000);
const OPENSTACK_TIMEOUT_MS = Number(process.env.OPENSTACK_TIMEOUT_MS || 15000);

function logConnectionErrorOnce(key, message) {
  const now = Date.now();
  if (now - lastConnectionErrorLog[key] < THROTTLE_MS) return;
  lastConnectionErrorLog[key] = now;
  console.warn(`[OpenStack] ${message} (indisponible; prochain log dans ${THROTTLE_MS / 1000}s)`);
}

function rewriteConsoleUrl(rawUrl) {
  try {
    if (!rawUrl) return null;
    const publicBase = process.env.NOVNC_PUBLIC_BASE_URL;
    if (!publicBase) return rawUrl;
    const src = new URL(rawUrl);
    const base = new URL(publicBase);
    src.protocol = base.protocol;
    src.host = base.host;
    return src.toString();
  } catch {
    return rawUrl;
  }
}

function withNovaProjectScope(baseUrl, projectId) {
  if (!baseUrl) return baseUrl;
  const clean = String(baseUrl).replace(/\/+$/, '');
  // If URL already includes project in path (e.g. /v2.1/<project_id>), keep it.
  if (/\/v2(?:\.\d+)?\/[^/]+$/i.test(clean)) return clean;
  if (!projectId) return clean;
  if (/\/v2(?:\.\d+)?$/i.test(clean)) return `${clean}/${projectId}`;
  return clean;
}

class OpenStackClient {
  constructor() {
    this.authToken = null;
    this.tokenExpiry = null;
    this.projectId = null;
    this.tokenCache = {};
    this.cache = new Map();
  }

  _logOpenstackConfigOnce() {
    if (this._logged) return;
    this._logged = true;
    const conf = {
      KEYSTONE_URL: process.env.KEYSTONE_URL,
      NOVA_URL: process.env.NOVA_URL,
      GLANCE_URL: process.env.GLANCE_URL,
      NEUTRON_URL: process.env.NEUTRON_URL,
      GNOCCHI_URL: process.env.GNOCCHI_URL || null,
      OPENSTACK_TIMEOUT_MS: process.env.OPENSTACK_TIMEOUT_MS,
      OPENSTACK_CACHE_TTL_MS: process.env.OPENSTACK_CACHE_TTL_MS,
      OS_USERNAME: !!process.env.OS_USERNAME,
      OS_PROJECT_NAME: process.env.OS_PROJECT_NAME,
      NOVNC_PUBLIC_BASE_URL: process.env.NOVNC_PUBLIC_BASE_URL
    };
    // eslint-disable-next-line no-console
    console.log('[openstack.js] config (redacted):', JSON.stringify(conf, null, 2));
  }

  _cacheGet(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  _cacheSet(key, value, ttlMs = CACHE_TTL_MS) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  _cacheDel(key) {
    this.cache.delete(key);
  }

  async getAuthToken(projectId = null) {
    this._logOpenstackConfigOnce();
    const cacheKey = projectId || 'default';
    const cached = this.tokenCache[cacheKey];
    if (cached && cached.expiry && new Date() < cached.expiry) {
      return cached.token;
    }

    try {
      const scope = projectId
        ? { project: { id: projectId } }
        : { project: { name: process.env.OS_PROJECT_NAME, domain: { id: 'default' } } };
      const response = await axios.post(`${process.env.KEYSTONE_URL}/auth/tokens`, {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: process.env.OS_USERNAME,
                domain: { id: 'default' },
                password: process.env.OS_PASSWORD
              }
            }
          },
          scope
        }
      });

      const token = response.headers['x-subject-token'];
      const expiry = new Date(Date.now() + 55 * 60 * 1000);
      this.tokenCache[cacheKey] = { token, expiry };
      if (!projectId) {
        this.authToken = token;
        this.tokenExpiry = expiry;
        this.projectId = response.data.token.project.id;
      }
      return token;
    } catch (error) {
      logConnectionErrorOnce('keystone', 'Auth: ' + (error.message || error.code || 'failed'));
      throw new Error('Failed to authenticate with OpenStack');
    }
  }

  async makeRequest(method, url, data = null, projectId = null, extraHeaders = null) {
    try {
      const token = await this.getAuthToken(projectId);
      const config = {
        method,
        url,
        timeout: OPENSTACK_TIMEOUT_MS,
        headers: {
          'X-Auth-Token': token,
          'Content-Type': 'application/json',
          ...(extraHeaders || {})
        }
      };
      if (data) config.data = data;
      logger.info('[OpenStack] request', {
        method,
        url,
        scopedProject: projectId || '(default)'
      });
      const response = await axios(config);
      logger.info('[OpenStack] response', {
        method,
        url,
        scopedProject: projectId || '(default)',
        status: response.status
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const body = error.response?.data;
      const msg = error.message || error.code || 'API error';
      logger.error('[OpenStack] request error', {
        method,
        url,
        scopedProject: projectId || '(default)',
        status,
        message: msg,
        body
      });
      logConnectionErrorOnce('nova', msg);
      throw error;
    }
  }

  // Nova (Compute) API methods
  async listServers() {
    return this.makeRequest('GET', `${process.env.NOVA_URL}/servers/detail`);
  }

  async getServer(serverId, projectId = null) {
    try {
      return await this.makeRequest('GET', `${process.env.NOVA_URL}/servers/${serverId}`, null, projectId);
    } catch (err) {
      const resolvedProjectId = projectId || this.projectId || process.env.OS_PROJECT_ID || null;
      const scopedNova = withNovaProjectScope(process.env.NOVA_URL, resolvedProjectId);
      if (scopedNova && scopedNova !== process.env.NOVA_URL) {
        try {
          logger.warn('[OpenStack] getServer retry with project-scoped Nova URL', {
            serverId,
            scopedProject: resolvedProjectId
          });
          return await this.makeRequest('GET', `${scopedNova}/servers/${serverId}`, null, projectId);
        } catch (_) {
          // Continue to next fallback branch below.
        }
      }
      // In multi-tenant mode, stale project mapping may yield 404.
      // Retry once with default admin scope to keep jobs resilient.
      if (projectId && err.response?.status === 404) {
        logger.warn('[OpenStack] getServer scoped 404, retrying default scope', {
          serverId,
          scopedProject: projectId
        });
        return this.makeRequest('GET', `${process.env.NOVA_URL}/servers/${serverId}`, null, null);
      }
      throw err;
    }
  }

  async createServer(serverData, projectId = null) {
    const result = await this.makeRequest('POST', `${process.env.NOVA_URL}/servers`, {
      server: serverData
    }, projectId);
    this._cacheDel('nova:listFlavors');
    return result;
  }

  async deleteServer(serverId, projectId = null) {
    const result = await this.makeRequest('DELETE', `${process.env.NOVA_URL}/servers/${serverId}`, null, projectId);
    this._cacheDel('nova:listFlavors');
    return result;
  }

  async serverAction(serverId, action, projectId = null) {
    return this.makeRequest('POST', `${process.env.NOVA_URL}/servers/${serverId}/action`, action, projectId);
  }

  async resizeServer(serverId, flavorRef, projectId = null) {
    const result = await this.serverAction(serverId, { resize: { flavorRef } }, projectId);
    this._cacheDel('nova:listFlavors');
    return result;
  }

  async confirmResize(serverId, projectId = null) {
    return this.serverAction(serverId, { 'confirmResize': null }, projectId);
  }

  async getConsoleUrl(serverId, projectId = null) {
    const url = `${process.env.NOVA_URL}/servers/${serverId}/remote-consoles`;
    const payload = {
      remote_console: {
        protocol: 'vnc',
        type: 'novnc'
      }
    };
    try {
      logger.info('[OpenStack] getConsoleUrl try', {
        serverId,
        scopedProject: projectId || '(default)'
      });
      const result = await this.makeRequest('POST', url, payload, projectId, {
        'X-OpenStack-Nova-API-Version': process.env.NOVA_CONSOLE_MICROVERSION || '2.6'
      });
      const consoleUrl = rewriteConsoleUrl(result.remote_console?.url || null);
      logger.info('[OpenStack] getConsoleUrl success', {
        serverId,
        scopedProject: projectId || '(default)',
        hasUrl: !!consoleUrl
      });
      return consoleUrl;
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      logger.error('[OpenStack] getConsoleUrl error', {
        serverId,
        scopedProject: projectId || '(default)',
        status,
        body
      });
      // Si on a un scope projet et que Nova renvoie 404, on tente un fallback en scope admin (projet par défaut)
      if (projectId && status === 404) {
        try {
          logger.info('[OpenStack] getConsoleUrl fallback default-scope', { serverId });
          const result = await this.makeRequest('POST', url, payload, null, {
            'X-OpenStack-Nova-API-Version': process.env.NOVA_CONSOLE_MICROVERSION || '2.6'
          });
          const consoleUrl = rewriteConsoleUrl(result.remote_console?.url || null);
          logger.info('[OpenStack] getConsoleUrl fallback success', {
            serverId,
            scopedProject: '(default)',
            hasUrl: !!consoleUrl
          });
          return consoleUrl;
        } catch (err2) {
          const status2 = err2.response?.status;
          const body2 = err2.response?.data;
          logger.error('[OpenStack] getConsoleUrl fallback error', {
            serverId,
            scopedProject: '(default)',
            status: status2,
            body: body2
          });
          throw err2;
        }
      }
      // Fallback legacy endpoint for older Nova deployments
      if ([404, 406].includes(status)) {
        const legacyActionUrl = `${process.env.NOVA_URL}/servers/${serverId}/action`;
        const legacyPayload = { 'os-getVNCConsole': { type: 'novnc' } };
        const legacyResult = await this.makeRequest('POST', legacyActionUrl, legacyPayload, projectId).catch(() => null);
        const legacyUrl = rewriteConsoleUrl(legacyResult?.console?.url || null);
        if (legacyUrl) {
          logger.info('[OpenStack] getConsoleUrl legacy success', { serverId, scopedProject: projectId || '(default)' });
          return legacyUrl;
        }
      }
      throw err;
    }
  }

  async createImageFromServer(serverId, imageName, projectId = null) {
    await this.serverAction(serverId, { createImage: { name: imageName } }, projectId);
    return { created: true, name: imageName };
  }

  async listFlavors() {
    const cacheKey = 'nova:listFlavors';
    const cached = this._cacheGet(cacheKey);
    if (cached) return cached;
    const result = await this.makeRequest('GET', `${process.env.NOVA_URL}/flavors/detail`);
    this._cacheSet(cacheKey, result);
    return result;
  }

  async getFlavor(flavorId, projectId = null) {
    const cacheKey = `nova:getFlavor:${projectId || 'default'}:${flavorId}`;
    const cached = this._cacheGet(cacheKey);
    if (cached) return cached;
    let result;
    try {
      result = await this.makeRequest('GET', `${process.env.NOVA_URL}/flavors/${flavorId}`, null, projectId);
    } catch (err) {
      if (projectId && err.response?.status === 404) {
        logger.warn('[OpenStack] getFlavor scoped 404, retrying default scope', {
          flavorId,
          scopedProject: projectId
        });
        result = await this.makeRequest('GET', `${process.env.NOVA_URL}/flavors/${flavorId}`, null, null);
      } else {
        throw err;
      }
    }
    this._cacheSet(cacheKey, result);
    return result;
  }

  // Glance (Images) API methods
  async listImages() {
    const cacheKey = 'glance:listImages';
    const cached = this._cacheGet(cacheKey);
    if (cached) return cached;
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${process.env.GLANCE_URL}/v2/images`, {
        headers: { 'X-Auth-Token': token }
      });
      const result = { images: response.data.images };
      this._cacheSet(cacheKey, result);
      return result;
    } catch (error) {
      // Fallback to Nova images API if Glance is not available
      const result = await this.makeRequest('GET', `${process.env.NOVA_URL}/images/detail`);
      this._cacheSet(cacheKey, result);
      return result;
    }
  }

  async getImage(imageId) {
    const cacheKey = `glance:getImage:${imageId}`;
    const cached = this._cacheGet(cacheKey);
    if (cached) return cached;
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${process.env.GLANCE_URL}/v2/images/${imageId}`, {
        headers: { 'X-Auth-Token': token }
      });
      const result = { image: response.data };
      this._cacheSet(cacheKey, result);
      return result;
    } catch (error) {
      const result = await this.makeRequest('GET', `${process.env.NOVA_URL}/images/${imageId}`);
      this._cacheSet(cacheKey, result);
      return result;
    }
  }

  // Neutron (Network) API methods
  async listNetworks() {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${process.env.NEUTRON_URL}/v2.0/networks`, {
        headers: { 'X-Auth-Token': token }
      });
      return response.data;
    } catch (error) {
      logConnectionErrorOnce('neutron', 'Networks: ' + (error.message || error.code));
      return { networks: [] };
    }
  }

  async listFloatingIPs() {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(`${process.env.NEUTRON_URL}/v2.0/floatingips`, {
        headers: { 'X-Auth-Token': token }
      });
      return response.data;
    } catch (error) {
      logConnectionErrorOnce('neutron', 'Floating IPs: ' + (error.message || error.code));
      return { floatingips: [] };
    }
  }

  async getServiceHealth() {
    const health = {
      keystone: { ok: false },
      nova: { ok: false },
      neutron: { ok: false },
      glance: { ok: false },
      gnocchi: { ok: false, configured: !!process.env.GNOCCHI_URL }
    };

    try {
      const token = await this.getAuthToken();
      health.keystone = { ok: !!token };

      const checks = [
        axios.get(`${process.env.NOVA_URL}/flavors/detail`, { headers: { 'X-Auth-Token': token }, timeout: 7000 })
          .then(() => { health.nova = { ok: true }; })
          .catch((e) => { health.nova = { ok: false, message: e.message, status: e.response?.status || null }; }),
        axios.get(`${process.env.NEUTRON_URL}/v2.0/networks`, { headers: { 'X-Auth-Token': token }, timeout: 7000 })
          .then(() => { health.neutron = { ok: true }; })
          .catch((e) => { health.neutron = { ok: false, message: e.message, status: e.response?.status || null }; }),
        axios.get(`${process.env.GLANCE_URL}/v2/images`, { headers: { 'X-Auth-Token': token }, timeout: 7000 })
          .then(() => { health.glance = { ok: true }; })
          .catch((e) => { health.glance = { ok: false, message: e.message, status: e.response?.status || null }; })
      ];

      if (process.env.GNOCCHI_URL) {
        checks.push(
          axios.get(`${process.env.GNOCCHI_URL}/v1/status`, { headers: { 'X-Auth-Token': token }, timeout: 7000 })
            .then(() => { health.gnocchi = { ok: true, configured: true }; })
            .catch(async (e) => {
              try {
                await axios.get(`${process.env.GNOCCHI_URL}/v1/archive_policy`, {
                  headers: { 'X-Auth-Token': token },
                  timeout: 7000
                });
                health.gnocchi = { ok: true, configured: true, fallback: 'archive_policy' };
              } catch (fallbackErr) {
                health.gnocchi = {
                  ok: false,
                  configured: true,
                  message: fallbackErr.message || e.message,
                  status: fallbackErr.response?.status || e.response?.status || null
                };
              }
            })
        );
      }

      await Promise.all(checks);
    } catch (e) {
      health.keystone = { ok: false, message: e.message };
    }

    health.overall = health.keystone.ok && health.nova.ok;
    return health;
  }
}

// Export a singleton instance
module.exports = new OpenStackClient();

