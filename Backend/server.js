const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { logEnvSnapshot, logSensitiveRuntimeHints } = require('./utils/envDebug');
logEnvSnapshot();
logSensitiveRuntimeHints();

const { testConnection, runMigrations, VM, User, ScalingEvent, VmRuntime } = require('./models');
const { Op } = require('sequelize');
const openstack = require('./config/openstack');
const { runThirtyMinuteBillingJob, runDailyPaymentJob } = require('./services/billingEngine');
const { MetricsMonitor } = require('./services/metricsMonitor');
const { AutoScaler } = require('./services/autoScaler');
const metricsCollector = require('./services/metricsCollector');

const BILLING_JOB_INTERVAL_MS      = 10 * 60 * 1000; // 10 min — cohérent avec SLICE_MINUTES=10
const DAILY_PAYMENT_JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SCALING_CHECK_INTERVAL_MS    = 30 * 1000;
const CONFIRM_RESIZE_INTERVAL_MS   = 1  * 60 * 1000;
const EXPIRED_VM_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const VM_RUNTIME_SYNC_INTERVAL_MS  = 2  * 60 * 1000;

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: process.env.AUTH_RATE_LIMIT_SKIP_SUCCESS !== 'false',
  message: { error: { message: 'Too many auth attempts', status: 429 } }
});
app.use('/api/auth', authLimiter);

const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.API_RATE_LIMIT_MAX || 1200),
  standardHeaders: true, legacyHeaders: false,
  message: { error: { message: 'Trop de requêtes, réessayez plus tard.', status: 429 } }
});
app.use('/api/', apiLimiter);

const logger = require('./utils/logger');
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.request(req.method, req.path, req.method !== 'GET' ? req.body : undefined);
  }
  next();
});

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/openstack',    require('./routes/openstack'));
app.use('/api/vms',          require('./routes/vms'));
app.use('/api/vm-templates', require('./routes/vmTemplates'));
app.use('/api/flavors',      require('./routes/flavors'));
app.use('/api/images',       require('./routes/images'));
app.use('/api/invoices',     require('./routes/invoices'));
app.use('/api/pricing-rules',require('./routes/pricingRules'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/admin',        require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'VM Marketplace Backend' });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  logger.error('Unhandled error', err.message, err.stack);
  res.status(status).json({ error: { message: err.message || 'Internal Server Error', status } });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: { message: 'Route not found', status: 404 } });
});

const PORT = process.env.PORT || 3001;

// Helper: include User avec alias cohérent (défini dans models/index.js)
const includeUser = { model: User, as: 'User', attributes: ['openstackProjectId'] };

const startServer = async () => {
  const ok = await testConnection();
  if (!ok && process.env.NODE_ENV !== 'test') {
    console.warn('Database connection failed.');
  }
  await runMigrations();
  if (process.env.NODE_ENV === 'test') return;

  // ── Billing job (30 min) ──
  const runBilling = () => runThirtyMinuteBillingJob()
    .then(r => { if (r.invoicesCreated > 0) console.log(`Billing: ${r.invoicesCreated} facture(s).`); return r; })
    .catch(err => console.error('Billing job error:', err.message));
  runBilling();
  setInterval(runBilling, BILLING_JOB_INTERVAL_MS);

  runDailyPaymentJob().catch(err => console.error('Daily payment error:', err.message));
  setInterval(() => runDailyPaymentJob().catch(err => console.error('Daily payment error:', err.message)), DAILY_PAYMENT_JOB_INTERVAL_MS);

  // ── Scaling ──
  const metricsMonitor = new MetricsMonitor();
  metricsMonitor.attach(new AutoScaler());
  setInterval(() => metricsMonitor.checkThresholds().catch(err => console.error('Scaling check error:', err.message)), SCALING_CHECK_INTERVAL_MS);

  // ── Confirm resize job ──
  const runConfirmResizeJob = async () => {
    try {
      const vms = await VM.findAll({
        where: { instanceId: { [Op.ne]: null } },
        include: [includeUser]  // CORRIGÉ: alias 'User' cohérent avec models/index.js
      });
      for (const vm of vms) {
        const projectId = vm.User?.openstackProjectId || null;
        try {
          const data = await openstack.getServer(vm.instanceId, projectId);
          const server = data.server || data;
          if ((server.status || '').toUpperCase() !== 'VERIFY_RESIZE') continue;

          await openstack.confirmResize(vm.instanceId, projectId);

          const refreshedData = await openstack.getServer(vm.instanceId, projectId).catch(() => null);
          const refreshed = refreshedData?.server || refreshedData;
          const actualFlavorId = refreshed?.flavor?.id || null;
          if (actualFlavorId && vm.flavorId !== actualFlavorId) {
            await vm.update({ flavorId: actualFlavorId });
          }

          const lastRequested = await ScalingEvent.findOne({
            where: {
              instanceId: vm.instanceId,
              action: { [Op.in]: ['resize_requested_up', 'resize_requested_down'] }
            },
            order: [['timestamp', 'DESC']]
          });

          if (lastRequested) {
            await ScalingEvent.create({
              instanceId: vm.instanceId,
              action: lastRequested.action === 'resize_requested_up' ? 'scale_up' : 'scale_down',
              oldFlavorId: lastRequested.oldFlavorId,
              newFlavorId: actualFlavorId || lastRequested.newFlavorId,
              triggerMetric: lastRequested.triggerMetric,
              triggerValue: lastRequested.triggerValue
            });
          }
          logger.info('Confirm resize', { instanceId: vm.instanceId, actualFlavorId });
        } catch (e) {
          logger.warn('Confirm resize vm error', vm.instanceId, e.message);
        }
      }
    } catch (err) {
      logger.error('Confirm resize job error', err.message);
    }
  };
  setInterval(runConfirmResizeJob, CONFIRM_RESIZE_INTERVAL_MS);
  runConfirmResizeJob().catch(e => logger.error('Confirm resize', e.message));

  // ── VM Runtime sync job ──
  const closeStatuses = new Set(['SHUTOFF', 'PAUSED', 'SUSPENDED', 'ERROR', 'DELETED']);
  const runVmRuntimeSyncJob = async () => {
    try {
      const vms = await VM.findAll({
        where: { instanceId: { [Op.ne]: null } },
        include: [includeUser]  // CORRIGÉ: alias 'User' cohérent
      });
      for (const vm of vms) {
        const projectId = vm.User?.openstackProjectId || null;
        try {
          const data = await openstack.getServer(vm.instanceId, projectId);
          const server = data.server || data;
          const status = String(server.status || '').toUpperCase();

          // Sync statut en DB
          if (status && status !== vm.status) {
            await vm.update({ status }).catch(() => {});
          }

          const openRuntime = await VmRuntime.findOne({
            where: { instanceId: vm.instanceId, userId: vm.userId, stoppedAt: null },
            order: [['startedAt', 'DESC']]
          });
          if (status === 'ACTIVE' && !openRuntime) {
            await VmRuntime.create({ instanceId: vm.instanceId, userId: vm.userId, startedAt: new Date(), stoppedAt: null });
          } else if (closeStatuses.has(status) && openRuntime) {
            openRuntime.stoppedAt = new Date();
            await openRuntime.save();
          }
        } catch (e) {
          logger.warn('VM runtime sync error', vm.instanceId, e.message);
        }
      }
    } catch (err) {
      logger.error('VM runtime sync job error', err.message);
    }
  };
  setInterval(runVmRuntimeSyncJob, VM_RUNTIME_SYNC_INTERVAL_MS);
  runVmRuntimeSyncJob().catch(e => logger.error('VM runtime sync', e.message));

  // ── Metrics collector ──
  try { metricsCollector.start(); } catch (err) { console.error('metricsCollector start error:', err.message); }

  // ── Expired VM cleanup ──
  const runExpiredVmCleanup = async () => {
    try {
      const expired = await VM.findAll({
        where: { expiresAt: { [Op.lt]: new Date() } },
        include: [includeUser]  // CORRIGÉ
      });
      for (const vm of expired) {
        const projectId = vm.User?.openstackProjectId || null;
        try { await openstack.deleteServer(vm.instanceId, projectId); }
        catch (e) { logger.warn('Expired VM delete OpenStack', vm.instanceId, e.message); }
        await VmRuntime.update(
          { stoppedAt: new Date() },
          { where: { instanceId: vm.instanceId, userId: vm.userId, stoppedAt: null } }
        );
        await vm.destroy();
      }
      if (expired.length > 0) logger.info('Expired VM cleanup', { count: expired.length });
    } catch (err) {
      logger.error('Expired VM cleanup error', err.message);
    }
  };
  setInterval(runExpiredVmCleanup, EXPIRED_VM_CLEANUP_INTERVAL_MS);
  runExpiredVmCleanup().catch(e => logger.error('Expired VM cleanup', e.message));

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   VM Marketplace Backend                   ║
║   Port: ${PORT}  Env: ${process.env.NODE_ENV || 'development'}         ║
║   ${new Date().toLocaleString()}          ║
╚════════════════════════════════════════════╝`);
    logger.info('Backend started', { PORT });
  });
};

const serverReady = startServer().catch(err => {
  if (require.main === module) { console.error('Server startup failed:', err); process.exit(1); }
});

if (require.main === module) serverReady.catch(() => {});

module.exports = app;
module.exports.serverReady = serverReady;
