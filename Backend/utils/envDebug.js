function redactSecret(value) {
  if (value === undefined || value === null) return null;
  const s = String(value);
  if (!s.length) return '';
  // Données sensibles: on ne logge jamais la valeur brute.
  return `***redacted***(${s.length})`;
}

function redactDbUrl(url) {
  if (!url) return url;
  // Exemple: postgresql://user:pass@host:5432/db -> postgresql://user:***@host:5432/db
  return String(url).replace(/(\/\/[^:]+):([^@]+)@/g, '$1:***@');
}

function redactPossibleToken(value) {
  if (!value) return value;
  const s = String(value);
  // Si ressemble à un token/JWT long, on ne logge pas.
  if (s.length > 24) return `***redacted***(${s.length})`;
  return redactSecret(s);
}

function envEnabled() {
  // Par défaut: en dev on affiche, en prod il faut expliciter.
  if (process.env.DEBUG_ENV_LOGS === 'true') return true;
  if (process.env.DEBUG_ENV_LOGS === 'false') return false;
  return (process.env.NODE_ENV || '').toLowerCase() !== 'production';
}

function logEnvSnapshot() {
  if (!envEnabled()) return;

  const snapshot = {
    NODE_ENV: process.env.NODE_ENV,
    TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS,

    // Auth/JWT
    JWT_SECRET_SET: !!process.env.JWT_SECRET,
    JWT_SECRET_LEN: process.env.JWT_SECRET ? String(process.env.JWT_SECRET).length : 0,

    // OpenStack endpoints
    OS_USERNAME_SET: !!process.env.OS_USERNAME,
    OS_PROJECT_NAME_SET: !!process.env.OS_PROJECT_NAME,
    KEYSTONE_URL: process.env.KEYSTONE_URL,
    NOVA_URL: process.env.NOVA_URL,
    GLANCE_URL: process.env.GLANCE_URL,
    NEUTRON_URL: process.env.NEUTRON_URL,
    OS_PASSWORD: redactSecret(process.env.OS_PASSWORD),
    OS_PROJECT_ID_SET: !!process.env.OS_PROJECT_ID,

    // Gnocchi/Ceilometer
    GNOCCHI_URL: process.env.GNOCCHI_URL,
    CEILOMETER_URL: process.env.CEILOMETER_URL,
    OPENSTACK_CACHE_TTL_MS: process.env.OPENSTACK_CACHE_TTL_MS,
    OPENSTACK_TIMEOUT_MS: process.env.OPENSTACK_TIMEOUT_MS,
    GNOCCHI_TIMEOUT_MS: process.env.GNOCCHI_TIMEOUT_MS,
    GNOCCHI_RETRIES: process.env.GNOCCHI_RETRIES,
    GNOCCHI_ERROR_THROTTLE_MS: process.env.GNOCCHI_ERROR_THROTTLE_MS,

    // noVNC
    NOVNC_PUBLIC_BASE_URL: process.env.NOVNC_PUBLIC_BASE_URL,
    NOVA_CONSOLE_MICROVERSION: process.env.NOVA_CONSOLE_MICROVERSION,

    // DB
    DATABASE_URL: redactDbUrl(process.env.DATABASE_URL),
    SQLITE_PATH: process.env.SQLITE_PATH,

    // Rate limits
    AUTH_RATE_LIMIT_WINDOW_MS: process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_SKIP_SUCCESS: process.env.AUTH_RATE_LIMIT_SKIP_SUCCESS,
    API_RATE_LIMIT_WINDOW_MS: process.env.API_RATE_LIMIT_WINDOW_MS,
    API_RATE_LIMIT_MAX: process.env.API_RATE_LIMIT_MAX,

    // Billing
    BILLING_OVERDUE_AFTER_DAYS: process.env.BILLING_OVERDUE_AFTER_DAYS
  };

  // eslint-disable-next-line no-console
  console.log('\n================ ENV SNAPSHOT (redacted) ================\n');
  console.log(JSON.stringify(snapshot, null, 2));
  console.log('\n=========================================================\n');
}

function logSensitiveRuntimeHints() {
  if (!envEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[envDebug] token examples: JWT_SECRET is redacted, OS_PASSWORD redacted');
}

module.exports = {
  logEnvSnapshot,
  logSensitiveRuntimeHints
};

