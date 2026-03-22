import axios from 'axios';
import { API } from '../config';

const getToken = () => localStorage.getItem('token');

// Log de la config API au chargement (une seule fois)
const _apiUrlLogged = { current: false };
function logApiConfig() {
  if (_apiUrlLogged.current) return;
  _apiUrlLogged.current = true;
  const base = API.BASE_URL || '(vide = URLs relatives)';
  const loginUrl = API.ENDPOINTS.AUTH_LOGIN || '';
  console.warn('[API] Config:', {
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    API_BASE_URL: base,
    AUTH_LOGIN: loginUrl,
    hint: base ? 'Le front appelle une URL absolue. Vérifiez CORS et que le backend écoute sur la même origine ou autorise cette origine.' : 'URLs relatives: le front et le backend doivent être servis ensemble (proxy Nginx ou même host).'
  });
}

// Create axios instance
const axiosInstance = axios.create({
  baseURL: API.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

const log = (msg, ...args) => {
  const ts = new Date().toISOString();
  console.log(`[API] ${ts} ${msg}`, ...args);
};

const logError = (msg, ...args) => {
  const ts = new Date().toISOString();
  console.error(`[API] ${ts} ${msg}`, ...args);
};

axiosInstance.interceptors.request.use((config) => {
  logApiConfig();
  const url = (config.baseURL || '') + (config.url || '');
  log('REQUEST', config.method?.toUpperCase(), url);
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (err) => {
  logError('REQUEST interceptor error', err?.message, err?.code, err);
  return Promise.reject(err);
});

axiosInstance.interceptors.response.use(
  (response) => {
    log('RESPONSE', response.status, response.config.method?.toUpperCase(), response.config.url);
    return response;
  },
  (error) => {
    const fullUrl = error.config ? (error.config.baseURL || '') + (error.config?.url || '') : '(inconnu)';
    const method = error.config?.method?.toUpperCase() || '?';

    if (error.response) {
      logError('API Error (réponse serveur)', {
        status: error.response.status,
        statusText: error.response.statusText,
        method,
        url: fullUrl,
        data: error.response.data,
        headers: error.response.headers ? { 'content-type': error.response.headers['content-type'] } : undefined
      });
      const status = error.response.status;
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-logout'));
        window.dispatchEvent(new CustomEvent('api-toast', { detail: { type: 'error', message: 'Session expirée. Veuillez vous reconnecter.' } }));
      } else if (status >= 500) {
        window.dispatchEvent(new CustomEvent('api-toast', { detail: { type: 'error', message: 'Erreur serveur. Réessayez plus tard.' } }));
      }
    } else {
      logError('API Error (connexion impossible)', {
        message: error.message,
        code: error.code,
        method,
        url: fullUrl,
        baseURL: error.config?.baseURL,
        timeout: error.code === 'ECONNABORTED' ? 'timeout' : undefined,
        hint: error.code === 'ERR_NETWORK' ? 'Vérifiez: backend démarré, URL correcte (REACT_APP_API_URL), CORS, pare-feu, proxy (nginx).' : undefined
      });
      window.dispatchEvent(new CustomEvent('api-toast', { detail: { type: 'error', message: 'Connexion au serveur impossible.' } }));
    }
    return Promise.reject(error);
  }
);

// API Service
export const apiService = {
  // Health check
  async checkHealth() {
    const response = await axiosInstance.get(API.ENDPOINTS.HEALTH);
    return response.data;
  },

  // OpenStack status
  async getOpenstackStatus() {
    const response = await axiosInstance.get(API.ENDPOINTS.OPENSTACK_STATUS);
    return response.data;
  },

  // VMs
  async getVMs() {
    const response = await axiosInstance.get(API.ENDPOINTS.VMS);
    return response.data;
  },

  async getVM(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_BY_ID(id));
    return response.data;
  },

  async createVM(vmData) {
    const response = await axiosInstance.post(API.ENDPOINTS.VMS, vmData);
    return response.data;
  },

  async getVmTemplates() {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_TEMPLATES);
    return response.data;
  },

  async getVmScalingPolicy(vmId) {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_SCALING_POLICY(vmId));
    return response.data;
  },
  async putVmScalingPolicy(vmId, policy) {
    const response = await axiosInstance.put(API.ENDPOINTS.VM_SCALING_POLICY(vmId), policy);
    return response.data;
  },

  async getVmMetrics(vmId) {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_METRICS(vmId));
    return response.data;
  },

  getVmMetricsStreamUrl(vmId) {
    const token = getToken();
    const path = API.ENDPOINTS.VM_METRICS_STREAM(vmId);
    const origin = API.BASE_URL || window.location.origin;
    const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    const separator = path.includes('?') ? '&' : '?';
    return token ? `${baseUrl}${path}${separator}token=${encodeURIComponent(token)}` : `${baseUrl}${path}`;
  },

  async getVmScalingHistory(vmId) {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_SCALING_HISTORY(vmId));
    return response.data;
  },

  async getVmConsole(vmId) {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_CONSOLE(vmId));
    return response.data;
  },

  async getAdminVmConsole(vmIdOrDbId) {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_VM_CONSOLE(vmIdOrDbId));
    return response.data;
  },

  async getVmConsoleByDbId(dbId) {
    const response = await axiosInstance.get(API.ENDPOINTS.VM_CONSOLE_BY_DB_ID(dbId));
    return response.data;
  },

  async createVmSnapshot(vmId, name) {
    const response = await axiosInstance.post(API.ENDPOINTS.VM_SNAPSHOT(vmId), name ? { name } : {});
    return response.data;
  },

  async deleteVM(id) {
    const response = await axiosInstance.delete(API.ENDPOINTS.VM_BY_ID(id));
    return response.data;
  },

  async vmAction(id, action) {
    const response = await axiosInstance.post(API.ENDPOINTS.VM_ACTION(id), { action });
    return response.data;
  },

  // Flavors
  async getFlavors() {
    const response = await axiosInstance.get(API.ENDPOINTS.FLAVORS);
    return response.data;
  },

  async getFlavor(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.FLAVOR_BY_ID(id));
    return response.data;
  },

  // Images
  async getImages() {
    const response = await axiosInstance.get(API.ENDPOINTS.IMAGES);
    return response.data;
  },

  async getImage(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.IMAGE_BY_ID(id));
    return response.data;
  },

  // Networks
  async getNetworks() {
    const response = await axiosInstance.get(API.ENDPOINTS.NETWORKS);
    return response.data;
  },

  async getFloatingIPs() {
    const response = await axiosInstance.get(API.ENDPOINTS.FLOATING_IPS);
    return response.data;
  },

  // Auth
  async register(data) {
    const response = await axiosInstance.post(API.ENDPOINTS.AUTH_REGISTER, data);
    return response.data;
  },
  async login(email, password) {
    const response = await axiosInstance.post(API.ENDPOINTS.AUTH_LOGIN, { email, password });
    return response.data;
  },
  async logout() {
    await axiosInstance.post(API.ENDPOINTS.AUTH_LOGOUT);
  },
  async getMe() {
    const response = await axiosInstance.get(API.ENDPOINTS.AUTH_ME);
    return response.data;
  },

  async changePassword(currentPassword, newPassword) {
    const response = await axiosInstance.put(API.ENDPOINTS.AUTH_CHANGE_PASSWORD, {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  // Invoices
  async getInvoices() {
    const response = await axiosInstance.get(API.ENDPOINTS.INVOICES);
    return response.data;
  },
  async getInvoice(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.INVOICE_BY_ID(id));
    return response.data;
  },
  getInvoiceDownloadUrl(id) {
    return `${API.ENDPOINTS.INVOICE_DOWNLOAD(id)}?token=${getToken()}`;
  },
  /** Download invoice PDF (uses Authorization header, no token in URL). */
  async downloadInvoicePdf(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.INVOICE_DOWNLOAD(id), {
      responseType: 'blob'
    });
    return response;
  },
  async payInvoice(id) {
    const response = await axiosInstance.post(API.ENDPOINTS.INVOICE_PAY(id));
    return response.data;
  },
  async getPricingRules() {
    const response = await axiosInstance.get(API.ENDPOINTS.PRICING_RULES);
    return response.data;
  },
  async getBillingPreferences() {
    const response = await axiosInstance.get(API.ENDPOINTS.INVOICE_PREFERENCES);
    return response.data;
  },
  async updateBillingPreferences(preferences) {
    const response = await axiosInstance.put(API.ENDPOINTS.INVOICE_PREFERENCES, preferences);
    return response.data;
  },

  // Notifications
  async getNotifications() {
    const response = await axiosInstance.get(API.ENDPOINTS.NOTIFICATIONS);
    return response.data;
  },
  async markNotificationRead(id) {
    const response = await axiosInstance.patch(API.ENDPOINTS.NOTIFICATION_READ(id));
    return response.data;
  },
  async markAllNotificationsRead() {
    const response = await axiosInstance.patch(API.ENDPOINTS.NOTIFICATIONS_READ_ALL);
    return response.data;
  },

  // Admin
  async getAdminVmTemplates() {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_VM_TEMPLATES);
    return response.data;
  },
  async createAdminVmTemplate(data) {
    const response = await axiosInstance.post(API.ENDPOINTS.ADMIN_VM_TEMPLATES, data);
    return response.data;
  },
  async updateAdminVmTemplate(id, data) {
    const response = await axiosInstance.put(API.ENDPOINTS.ADMIN_VM_TEMPLATE_BY_ID(id), data);
    return response.data;
  },
  async deleteAdminVmTemplate(id) {
    const response = await axiosInstance.delete(API.ENDPOINTS.ADMIN_VM_TEMPLATE_BY_ID(id));
    return response.data;
  },
  async getAdminScaleUpRule() {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_SCALE_UP_RULE);
    return response.data;
  },
  async putAdminScaleUpRule(data) {
    const response = await axiosInstance.put(API.ENDPOINTS.ADMIN_SCALE_UP_RULE, data);
    return response.data;
  },
  async getAdminStats() {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_STATS);
    return response.data;
  },
  async getAdminVms() {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_VMS);
    return response.data;
  },
  async getAdminVM(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_VM_BY_ID(id));
    return response.data;
  },
  async adminVmAction(vmIdOrDbId, action) {
    const response = await axiosInstance.post(`${API.ENDPOINTS.ADMIN_VMS}/${vmIdOrDbId}/action`, { action });
    return response.data;
  },
  async deleteAdminVM(vmIdOrDbId) {
    const response = await axiosInstance.delete(API.ENDPOINTS.ADMIN_VM_DELETE(vmIdOrDbId));
    return response.data;
  },
  async updateAdminUser(id, data) {
    const response = await axiosInstance.patch(`${API.ENDPOINTS.ADMIN_USERS}/${id}`, data);
    return response.data;
  },
  async getAdminUsers(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    const url = `${API.ENDPOINTS.ADMIN_USERS}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },
  async getAdminInvoices(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    const url = `${API.ENDPOINTS.ADMIN_INVOICES}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await axiosInstance.get(url);
    return response.data;
  },
  async getAdminInvoice(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_INVOICE_BY_ID(id));
    return response.data;
  },
  async downloadAdminInvoicePdf(id) {
    const response = await axiosInstance.get(API.ENDPOINTS.ADMIN_INVOICE_DOWNLOAD(id), {
      responseType: 'blob'
    });
    return response;
  },
};

export default apiService;
export { getToken };

