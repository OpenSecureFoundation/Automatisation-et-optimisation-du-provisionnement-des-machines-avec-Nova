/**
 * Logger simple pour tracer toutes les opérations (logs serveur PM2).
 * Utiliser dans les controllers et routes pour diagnostiquer les erreurs.
 */
const prefix = '[Backend]';

function log(level, ...args) {
  const ts = new Date().toISOString();
  console.log(ts, prefix, level, ...args);
}

module.exports = {
  info(...args) {
    log('INFO', ...args);
  },
  warn(...args) {
    log('WARN', ...args);
  },
  error(...args) {
    log('ERROR', ...args);
  },
  /** Log d'une requête entrante (méthode, path, body si présent) */
  request(method, path, body = undefined) {
    const payload = body !== undefined ? { body: typeof body === 'object' ? { ...body, password: body.password ? '[REDACTED]' : undefined } : body } : {};
    log('REQUEST', method, path, Object.keys(payload).length ? payload : '');
  },
  /** Log d'une réponse erreur (status, message, details) */
  resError(status, message, details = null) {
    log('RES_ERROR', status, message, details ? JSON.stringify(details) : '');
  }
};
