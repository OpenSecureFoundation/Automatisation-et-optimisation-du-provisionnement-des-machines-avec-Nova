import axios from 'axios';
import { API } from '../config';

const getToken = () => localStorage.getItem('token');

const _apiUrlLogged = { current: false };
function logApiConfig() {
  if (_apiUrlLogged.current) return;
  _apiUrlLogged.current = true;
  console.warn('[API] Config:', {
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    API_BASE_URL: API.BASE_URL || '(relative)',
  });
}

const axiosInstance = axios.create({
  baseURL: API.BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

const log      = (msg, ...args) => console.log(`[API] ${new Date().toISOString()} ${msg}`, ...args);
const logError = (msg, ...args) => console.error(`[API] ${new Date().toISOString()} ${msg}`, ...args);

axiosInstance.interceptors.request.use((config) => {
  logApiConfig();
  log('REQUEST', config.method?.toUpperCase(), (config.baseURL || '') + (config.url || ''));
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, err => { logError('REQUEST interceptor error', err?.message); return Promise.reject(err); });

axiosInstance.interceptors.response.use(
  response => {
    log('RESPONSE', response.status, response.config.method?.toUpperCase(), response.config.url);
    return response;
  },
  error => {
    const fullUrl = error.config ? (error.config.baseURL || '') + (error.config?.url || '') : '(inconnu)';
    if (error.response) {
      logError('API Error', error.response.status, error.config?.method?.toUpperCase(), fullUrl);
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth-logout'));
        window.dispatchEvent(new CustomEvent('api-toast', { detail: { type: 'error', message: 'Session expirée. Veuillez vous reconnecter.' } }));
      } else if (error.response.status >= 500) {
        window.dispatchEvent(new CustomEvent('api-toast', { detail: { type: 'error', message: 'Erreur serveur. Réessayez plus tard.' } }));
      }
    } else {
      logError('API Error (réseau)', error.message, error.code, fullUrl);
      window.dispatchEvent(new CustomEvent('api-toast', { detail: { type: 'error', message: 'Connexion au serveur impossible.' } }));
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // ── Health ──
  async checkHealth() { return (await axiosInstance.get(API.ENDPOINTS.HEALTH)).data; },
  async getOpenstackStatus() { return (await axiosInstance.get(API.ENDPOINTS.OPENSTACK_STATUS)).data; },

  // ── VMs ──
  // NOTE: deux alias pour compatibilité (getVMs avec majuscule ET getVms minuscule)
  async getVMs() { return (await axiosInstance.get(API.ENDPOINTS.VMS)).data; },
  async getVms() { return (await axiosInstance.get(API.ENDPOINTS.VMS)).data; },  // alias minuscule
  async getVM(id) { return (await axiosInstance.get(API.ENDPOINTS.VM_BY_ID(id))).data; },
  async createVM(vmData) { return (await axiosInstance.post(API.ENDPOINTS.VMS, vmData)).data; },

  async getVmTemplates() { return (await axiosInstance.get(API.ENDPOINTS.VM_TEMPLATES)).data; },
  async getVmScalingPolicy(vmId) { return (await axiosInstance.get(API.ENDPOINTS.VM_SCALING_POLICY(vmId))).data; },
  async putVmScalingPolicy(vmId, policy) { return (await axiosInstance.put(API.ENDPOINTS.VM_SCALING_POLICY(vmId), policy)).data; },
  async getVmMetrics(vmId) { return (await axiosInstance.get(API.ENDPOINTS.VM_METRICS(vmId))).data; },

  getVmMetricsStreamUrl(vmId) {
    const token = getToken();
    const path  = API.ENDPOINTS.VM_METRICS_STREAM(vmId);
    const origin = API.BASE_URL || window.location.origin;
    const base  = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    const sep   = path.includes('?') ? '&' : '?';
    return token ? `${base}${path}${sep}token=${encodeURIComponent(token)}` : `${base}${path}`;
  },

  async getVmScalingHistory(vmId) { return (await axiosInstance.get(API.ENDPOINTS.VM_SCALING_HISTORY(vmId))).data; },
  async getVmConsole(vmId) { return (await axiosInstance.get(API.ENDPOINTS.VM_CONSOLE(vmId))).data; },
  async getVmConsoleByDbId(dbId) { return (await axiosInstance.get(API.ENDPOINTS.VM_CONSOLE_BY_DB_ID(dbId))).data; },
  async createVmSnapshot(vmId, name) { return (await axiosInstance.post(API.ENDPOINTS.VM_SNAPSHOT(vmId), name ? { name } : {})).data; },
  async deleteVM(id) { return (await axiosInstance.delete(API.ENDPOINTS.VM_BY_ID(id))).data; },
  async vmAction(id, action) { return (await axiosInstance.post(API.ENDPOINTS.VM_ACTION(id), { action })).data; },

  // ── Flavors ──
  async getFlavors() { return (await axiosInstance.get(API.ENDPOINTS.FLAVORS)).data; },
  async getFlavor(id) { return (await axiosInstance.get(API.ENDPOINTS.FLAVOR_BY_ID(id))).data; },

  // ── Images ──
  async getImages() { return (await axiosInstance.get(API.ENDPOINTS.IMAGES)).data; },
  async getImage(id) { return (await axiosInstance.get(API.ENDPOINTS.IMAGE_BY_ID(id))).data; },

  // ── Networks ──
  async getNetworks() { return (await axiosInstance.get(API.ENDPOINTS.NETWORKS)).data; },
  async getFloatingIPs() { return (await axiosInstance.get(API.ENDPOINTS.FLOATING_IPS)).data; },

  // ── Auth ──
  async register(data) { return (await axiosInstance.post(API.ENDPOINTS.AUTH_REGISTER, data)).data; },
  async login(email, password) { return (await axiosInstance.post(API.ENDPOINTS.AUTH_LOGIN, { email, password })).data; },
  async logout() { await axiosInstance.post(API.ENDPOINTS.AUTH_LOGOUT); },
  async getMe() { return (await axiosInstance.get(API.ENDPOINTS.AUTH_ME)).data; },
  async changePassword(currentPassword, newPassword) {
    return (await axiosInstance.put(API.ENDPOINTS.AUTH_CHANGE_PASSWORD, { currentPassword, newPassword })).data;
  },

  // ── Invoices (client) ──
  async getInvoices() { return (await axiosInstance.get(API.ENDPOINTS.INVOICES)).data; },
  async getInvoice(id) { return (await axiosInstance.get(API.ENDPOINTS.INVOICE_BY_ID(id))).data; },
  async downloadInvoicePdf(id) { return axiosInstance.get(API.ENDPOINTS.INVOICE_DOWNLOAD(id), { responseType: 'blob' }); },
  async payInvoice(id) { return (await axiosInstance.post(API.ENDPOINTS.INVOICE_PAY(id))).data; },
  async getPricingRules() { return (await axiosInstance.get(API.ENDPOINTS.PRICING_RULES)).data; },
  async getBillingPreferences() { return (await axiosInstance.get(API.ENDPOINTS.INVOICE_PREFERENCES)).data; },
  async updateBillingPreferences(prefs) { return (await axiosInstance.put(API.ENDPOINTS.INVOICE_PREFERENCES, prefs)).data; },

  // ── Notifications ──
  async getNotifications() { return (await axiosInstance.get(API.ENDPOINTS.NOTIFICATIONS)).data; },
  async markNotificationRead(id) { return (await axiosInstance.patch(API.ENDPOINTS.NOTIFICATION_READ(id))).data; },
  async markAllNotificationsRead() { return (await axiosInstance.patch(API.ENDPOINTS.NOTIFICATIONS_READ_ALL)).data; },

  // ── Admin: VM Templates ──
  async getAdminVmTemplates() { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_VM_TEMPLATES)).data; },
  async createAdminVmTemplate(data) { return (await axiosInstance.post(API.ENDPOINTS.ADMIN_VM_TEMPLATES, data)).data; },
  async updateAdminVmTemplate(id, data) { return (await axiosInstance.put(API.ENDPOINTS.ADMIN_VM_TEMPLATE_BY_ID(id), data)).data; },
  async deleteAdminVmTemplate(id) { return (await axiosInstance.delete(API.ENDPOINTS.ADMIN_VM_TEMPLATE_BY_ID(id))).data; },

  // ── Admin: Scale-up rule ──
  async getAdminScaleUpRule() { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_SCALE_UP_RULE)).data; },
  async putAdminScaleUpRule(data) { return (await axiosInstance.put(API.ENDPOINTS.ADMIN_SCALE_UP_RULE, data)).data; },

  // ── Admin: Stats & VMs ──
  async getAdminStats() { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_STATS)).data; },
  async getAdminVms() { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_VMS)).data; },
  // alias pour cohérence (DashboardLayout utilise getAdminVms)
  async getAdminVMs() { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_VMS)).data; },
  async getAdminVM(id) { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_VM_BY_ID(id))).data; },
  async getAdminVmConsole(id) { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_VM_CONSOLE(id))).data; },
  async adminVmAction(id, action) { return (await axiosInstance.post(`${API.ENDPOINTS.ADMIN_VMS}/${id}/action`, { action })).data; },
  async deleteAdminVM(id) { return (await axiosInstance.delete(API.ENDPOINTS.ADMIN_VM_DELETE(id))).data; },

  // ── Admin: Users ──
  async getAdminUsers(params = {}) {
    const q = new URLSearchParams();
    if (params.page)   q.append('page', params.page);
    if (params.limit)  q.append('limit', params.limit);
    if (params.search) q.append('search', params.search);
    const url = `${API.ENDPOINTS.ADMIN_USERS}${q.toString() ? '?' + q.toString() : ''}`;
    return (await axiosInstance.get(url)).data;
  },
  async updateAdminUser(id, data) { return (await axiosInstance.patch(`${API.ENDPOINTS.ADMIN_USERS}/${id}`, data)).data; },

  // ── Admin: Invoices ──
  async getAdminInvoices(params = {}) {
    const q = new URLSearchParams();
    if (params.status)   q.append('status', params.status);
    if (params.userId)   q.append('userId', params.userId);
    if (params.dateFrom) q.append('dateFrom', params.dateFrom);
    if (params.dateTo)   q.append('dateTo', params.dateTo);
    if (params.sort)     q.append('sort', params.sort);
    if (params.order)    q.append('order', params.order);
    if (params.page)     q.append('page', params.page);
    if (params.limit)    q.append('limit', params.limit);
    const url = `${API.ENDPOINTS.ADMIN_INVOICES}${q.toString() ? '?' + q.toString() : ''}`;
    return (await axiosInstance.get(url)).data;
  },
  async getAdminInvoice(id) { return (await axiosInstance.get(API.ENDPOINTS.ADMIN_INVOICE_BY_ID(id))).data; },
  async downloadAdminInvoicePdf(id) { return axiosInstance.get(API.ENDPOINTS.ADMIN_INVOICE_DOWNLOAD(id), { responseType: 'blob' }); },
};

export default apiService;
export { getToken };
