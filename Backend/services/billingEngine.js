const { Op } = require('sequelize');
const { ResourceUsage, PricingRule, VM, VmRuntime, Invoice, InvoiceItem, UsageSlice, User, PaymentMethod, ScalingEvent } = require('../models');
const { createNotification } = require('./notificationService');
const openstack = require('../config/openstack');
const logger = require('../utils/logger');

const DEFAULT_CURRENCY = 'XAF';
const SLICE_MINUTES = 10;
const OVERDUE_AFTER_DAYS = Number(process.env.BILLING_OVERDUE_AFTER_DAYS || 7);

async function getPricingRules(effectiveDate = new Date()) {
  const dateStr = effectiveDate.toISOString().slice(0, 10);
  const rules = await PricingRule.findAll({
    where: { effectiveDate: { [Op.lte]: dateStr } },
    order: [['effectiveDate', 'DESC']]
  });
  const byResource = {};
  for (const r of rules) {
    if (!byResource[r.resourceType]) byResource[r.resourceType] = r;
  }
  return byResource;
}

function calculateConsumptionCost(metrics, pricingRules) {
  const cpuPerHour = Number(pricingRules.cpu?.unitPrice ?? 200);
  const ramPerGbHour = Number(pricingRules.ram?.unitPrice ?? 50);
  const storagePerGbHour = Number(pricingRules.storage?.unitPrice ?? 0.01);
  const uptimeHours = Number(metrics.uptimeHours ?? 0);
  const vcpus = Number(metrics.vcpus ?? 1);
  const ramGb = Number(metrics.ram_gb ?? 0);
  const diskGb = Number(metrics.disk_gb ?? 0);
  const cpuUtilPercent = Number(metrics.cpu_util ?? 100);
  const cpuFactor = Number.isFinite(cpuUtilPercent)
    ? Math.max(0, Math.min(100, cpuUtilPercent)) / 100
    : 1;
  const breakdown = {
    cpu: Math.round(uptimeHours * vcpus * cpuPerHour * cpuFactor * 100) / 100,
    memory: Math.round(uptimeHours * ramGb * ramPerGbHour * 100) / 100,
    storage: Math.round(uptimeHours * diskGb * storagePerGbHour * 100) / 100
  };
  const total = breakdown.cpu + breakdown.memory + breakdown.storage;
  return { total: Math.round(total * 100) / 100, breakdown, currency: DEFAULT_CURRENCY };
}

function calculateHourlyCost(metrics, pricingRules) {
  return calculateConsumptionCost(metrics, pricingRules);
}

function getDurationHours(start, end) {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
}

async function getEffectiveUptimeHours(vm, periodStart, periodEnd) {
  if (!vm?.instanceId || !vm?.userId) return 0;
  const runtimes = await VmRuntime.findAll({
    where: {
      instanceId: vm.instanceId,
      userId: vm.userId,
      startedAt: { [Op.lt]: periodEnd },
      [Op.or]: [{ stoppedAt: null }, { stoppedAt: { [Op.gt]: periodStart } }]
    }
  });
  let total = 0;
  for (const rt of runtimes) {
    const start = new Date(Math.max(new Date(rt.startedAt).getTime(), periodStart.getTime()));
    const stopTs = rt.stoppedAt ? new Date(rt.stoppedAt).getTime() : periodEnd.getTime();
    const end = new Date(Math.min(stopTs, periodEnd.getTime()));
    total += getDurationHours(start, end);
  }
  return total;
}

async function aggregateMetricsForVM(vmId, periodStart, periodEnd) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const usages = await ResourceUsage.findAll({
    where: { vmId, timestamp: { [Op.between]: [start, end] } },
    order: [['timestamp', 'ASC']]
  });
  const byType = {};
  for (const u of usages) {
    if (!byType[u.metricType]) byType[u.metricType] = [];
    byType[u.metricType].push(Number(u.value));
  }
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const vm = await VM.findByPk(vmId);
  const uptimeHours = await getEffectiveUptimeHours(vm, start, end);
  const specs = await getFlavorSpecs(vm?.flavorId || null);
  return {
    uptimeHours,
    cpu_util: avg(byType.cpu_util || []),
    memory_usage: avg(byType.memory_usage || []),
    disk_usage: avg(byType.disk_usage || []),
    vcpus: specs.vcpus,
    ram_gb: specs.ramMb / 1024,
    disk_gb: specs.diskGb
  };
}

async function calculateInvoiceForPeriod(userId, periodStart, periodEnd) {
  const { VM } = require('../models');
  const vms = await VM.findAll({ where: { userId } });
  const pricingRules = await getPricingRules(new Date(periodEnd));
  const items = [];
  let totalAmount = 0;
  for (const vm of vms) {
    const metrics = await aggregateMetricsForVM(vm.id, periodStart, periodEnd);
    if (metrics.uptimeHours <= 0) continue;
    const cost = calculateConsumptionCost(metrics, pricingRules);
    if (cost.total <= 0) continue;
    totalAmount += cost.total;
    items.push({
      description: `VM ${vm.name || vm.instanceId} - Compute`,
      quantity: metrics.uptimeHours,
      unitPrice: cost.total / metrics.uptimeHours,
      total: cost.total
    });
  }
  return { totalAmount, items, currency: DEFAULT_CURRENCY };
}

const DEFAULT_FLAVOR_SPECS = { vcpus: 1, ramMb: 1024, diskGb: 20 };

const flavorCache = new Map();
async function getFlavorSpecs(flavorId) {
  if (!flavorId) {
    return { ...DEFAULT_FLAVOR_SPECS };
  }
  if (flavorCache.has(flavorId)) {
    return flavorCache.get(flavorId);
  }
  try {
    const data = await openstack.getFlavor(flavorId);
    const f = data.flavor || data;
    const specs = {
      vcpus: Number(f.vcpus) || 1,
      ramMb: Number(f.ram) || 512,
      diskGb: Number(f.disk) || 0
    };
    flavorCache.set(flavorId, specs);
    return specs;
  } catch (err) {
    return { ...DEFAULT_FLAVOR_SPECS };
  }
}

async function calculateSliceAmount(flavorId, durationHours, options = {}) {
  const rules = await getPricingRules(new Date());
  const specs = await getFlavorSpecs(flavorId);
  const metrics = {
    uptimeHours: durationHours,
    cpu_util: Number(options.cpuUtilPercent),
    vcpus: specs.vcpus,
    ram_gb: specs.ramMb / 1024,
    disk_gb: specs.diskGb
  };
  return calculateConsumptionCost(metrics, rules).total;
}

async function getAvgCpuUtilForVmInRange(vmId, start, end) {
  const rows = await ResourceUsage.findAll({
    where: {
      vmId,
      metricType: 'cpu_util',
      timestamp: { [Op.between]: [start, end] }
    },
    attributes: ['value']
  });
  if (!rows.length) return null;
  const values = rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getLastSliceEnd(now = new Date()) {
  const ms = now.getTime();
  const sliceMs = SLICE_MINUTES * 60 * 1000;
  return new Date(Math.floor(ms / sliceMs) * sliceMs);
}

async function getRuntimeOverlapsForSlice(sliceStart, sliceEnd) {
  const runtimes = await VmRuntime.findAll({
    where: {
      startedAt: { [Op.lt]: sliceEnd },
      [Op.or]: [
        { stoppedAt: null },
        { stoppedAt: { [Op.gt]: sliceStart } }
      ]
    }
  });
  const byKey = {};
  for (const r of runtimes) {
    const start = new Date(Math.max(r.startedAt.getTime(), sliceStart.getTime()));
    const end = r.stoppedAt
      ? new Date(Math.min(r.stoppedAt.getTime(), sliceEnd.getTime()))
      : new Date(sliceEnd.getTime());
    const durationHours = Math.max(0, (end - start) / (1000 * 60 * 60));
    if (durationHours <= 0) continue;
    const key = `${r.userId}:${r.instanceId}`;
    if (!byKey[key]) {
      byKey[key] = { userId: r.userId, instanceId: r.instanceId, durationHours: 0, intervals: [] };
    }
    byKey[key].durationHours += durationHours;
    byKey[key].intervals.push({ start, end });
  }
  return Object.values(byKey);
}

async function resolveVmDisplayName(vm, projectId = null) {
  if (vm?.name && String(vm.name).trim()) return vm.name;
  if (!vm?.instanceId) return null;
  try {
    const data = await openstack.getServer(vm.instanceId, projectId);
    const server = data?.server ?? data;
    const resolved = server?.name ? String(server.name).trim() : null;
    if (resolved && resolved !== vm.name) {
      await vm.update({ name: resolved });
    }
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Découpe [intervalStart, intervalEnd] en segments par flavor en utilisant les ScalingEvents.
 * Retourne [{ start, end, flavorId, isScaleUp }]
 */
async function getFlavorSegmentsForInterval(instanceId, intervalStart, intervalEnd, flavorAtEnd) {
  const events = await ScalingEvent.findAll({
    where: {
      instanceId,
      timestamp: { [Op.between]: [intervalStart, intervalEnd] }
    },
    order: [['timestamp', 'ASC']]
  });
  if (!events.length) {
    return [{ start: new Date(intervalStart.getTime()), end: new Date(intervalEnd.getTime()), flavorId: flavorAtEnd, isScaleUp: false, scalingEventAction: null }];
  }
  const segments = [];
  let t = intervalStart.getTime();
  for (const ev of events) {
    const evTs = new Date(ev.timestamp).getTime();
    if (t < evTs) {
      segments.push({
        start: new Date(t),
        end: new Date(evTs),
        flavorId: ev.oldFlavorId || flavorAtEnd,
        isScaleUp: false,
        scalingEventAction: null
      });
    }
    t = evTs;
  }
  if (t < intervalEnd.getTime()) {
    const lastEvent = events[events.length - 1];
    segments.push({
      start: new Date(t),
      end: new Date(intervalEnd.getTime()),
      flavorId: lastEvent.newFlavorId || flavorAtEnd,
      isScaleUp: lastEvent.action?.includes('up') ?? false,
      scalingEventAction: lastEvent.action || null
    });
  }
  return segments;
}

/**
 * Construit une description lisible pour une ligne de facture.
 * Inclut le détail du flavor et signale clairement les périodes de scale up.
 */
async function buildInvoiceItemDescription(vmDisplayName, flavorId, segHours, isScaleUp, scalingEventAction) {
  const minutes = Math.round(segHours * 60);
  let flavorLabel = flavorId ? flavorId.slice(0, 8) : '—';
  try {
    const specs = await getFlavorSpecs(flavorId);
    if (specs && (specs.vcpus > 1 || specs.ramMb > 512)) {
      flavorLabel = `${specs.vcpus}vCPU/${(specs.ramMb / 1024).toFixed(0)}GB`;
    }
  } catch (_) {}

  if (isScaleUp || (scalingEventAction && scalingEventAction.includes('up'))) {
    return `VM ${vmDisplayName} — Scale UP (${flavorLabel}) — ${minutes} min`;
  }
  return `VM ${vmDisplayName} — Config: ${flavorLabel} — ${minutes} min`;
}

async function runBillingJobForSlice(sliceEnd) {
  const sliceStart = new Date(sliceEnd.getTime() - SLICE_MINUTES * 60 * 1000);
  const overlaps = await getRuntimeOverlapsForSlice(sliceStart, sliceEnd);
  logger.info('Billing job slice', {
    sliceStart: sliceStart.toISOString(),
    sliceEnd: sliceEnd.toISOString(),
    overlapsCount: overlaps.length
  });
  if (overlaps.length === 0) return { invoicesCreated: 0 };

  const byUser = {};
  for (const o of overlaps) {
    if (!byUser[o.userId]) byUser[o.userId] = [];
    byUser[o.userId].push(o);
  }

  const MIN_USAGE_HOURS_FOR_INVOICE = 1 / 60;
  let invoicesCreated = 0;

  for (const [userId, userOverlaps] of Object.entries(byUser)) {
    const existing = await Invoice.findOne({
      where: { userId, periodStart: sliceStart, periodEnd: sliceEnd }
    });
    if (existing) continue;

    const totalDurationHours = userOverlaps.reduce((sum, o) => sum + (o.durationHours || 0), 0);
    if (totalDurationHours < MIN_USAGE_HOURS_FOR_INVOICE) {
      logger.info('Billing job: skip invoice (usage below minimum)', { userId, totalDurationHours });
      continue;
    }

    // lineItems : une entrée par segment de flavor par VM
    // Permet de lister séparément les périodes normales et les périodes scale up
    const lineItems = [];
    let totalAmount = 0;

    for (const o of userOverlaps) {
      const vm = await VM.findOne({
        where: { instanceId: o.instanceId, userId: o.userId },
        include: [{ model: User, as: 'User', attributes: ['openstackProjectId'] }]
      });
      if (!vm) {
        logger.warn('Billing job: VM missing in DB, skipping overlap', { userId: o.userId, instanceId: o.instanceId });
        continue;
      }
      const displayName = await resolveVmDisplayName(vm, vm.User?.openstackProjectId || null);
      const flavorAtEnd = vm?.flavorId || null;

      for (const { start: intStart, end: intEnd } of (o.intervals || [])) {
        const segments = await getFlavorSegmentsForInterval(o.instanceId, intStart, intEnd, flavorAtEnd);

        for (const seg of segments) {
          const segHours = (seg.end.getTime() - seg.start.getTime()) / (1000 * 60 * 60);
          if (segHours <= 0) continue;

          const avgCpuUtil = await getAvgCpuUtilForVmInRange(vm.id, seg.start, seg.end);
          const segAmount = await calculateSliceAmount(seg.flavorId || null, segHours, { cpuUtilPercent: avgCpuUtil });
          const roundedAmount = Math.round(segAmount * 100) / 100;

          if (roundedAmount <= 0) continue;

          const description = await buildInvoiceItemDescription(
            displayName || vm?.name || o.instanceId.slice(0, 8),
            seg.flavorId,
            segHours,
            seg.isScaleUp,
            seg.scalingEventAction
          );

          totalAmount += roundedAmount;
          lineItems.push({
            description,
            quantity: segHours,
            unitPrice: segHours > 0 ? Math.round((roundedAmount / segHours) * 100) / 100 : 0,
            total: roundedAmount,
            instanceId: o.instanceId,
            isScaleUp: seg.isScaleUp
          });
        }
      }
    }

    if (totalAmount <= 0 || lineItems.length === 0) {
      logger.info('Billing job: skip invoice (totalAmount <= 0)', { userId, totalAmount, sliceStart, sliceEnd });
      continue;
    }

    const count = await Invoice.count();
    const invoiceNumber = `INV-${sliceEnd.getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const invoice = await Invoice.create({
      userId,
      invoiceNumber,
      periodStart: sliceStart,
      periodEnd: sliceEnd,
      totalAmount: Math.round(totalAmount * 100) / 100,
      currency: DEFAULT_CURRENCY,
      status: 'pending'
    });

    // Créer une ligne de facture par segment de flavor
    for (const item of lineItems) {
      await InvoiceItem.create({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      });

      // UsageSlice par VM (agrégé par instanceId)
      const existingSlice = await UsageSlice.findOne({
        where: { userId, instanceId: item.instanceId, sliceStart, sliceEnd, invoiceId: invoice.id }
      });
      if (!existingSlice) {
        await UsageSlice.create({
          userId,
          instanceId: item.instanceId,
          sliceStart,
          sliceEnd,
          amount: item.total,
          currency: DEFAULT_CURRENCY,
          invoiceId: invoice.id
        });
      } else {
        // Ajouter au montant existant de cette VM pour cette tranche
        existingSlice.amount = Math.round((Number(existingSlice.amount) + item.total) * 100) / 100;
        await existingSlice.save();
      }
    }

    await createNotification(userId, {
      type: 'invoice',
      title: 'Nouvelle facture',
      message: `Facture ${invoice.invoiceNumber} : ${Number(invoice.totalAmount).toLocaleString('fr-FR')} ${invoice.currency}`,
      link: '/client/billing'
    });
    invoicesCreated += 1;
  }

  if (invoicesCreated > 0) {
    logger.info('Billing job: invoices created', { count: invoicesCreated, sliceEnd: sliceEnd.toISOString() });
  }
  return { invoicesCreated };
}

async function runThirtyMinuteBillingJob() {
  const sliceEnd = getLastSliceEnd(new Date());
  return runBillingJobForSlice(sliceEnd);
}

async function runDailyPaymentJob() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const overdueThreshold = new Date();
  overdueThreshold.setDate(overdueThreshold.getDate() - OVERDUE_AFTER_DAYS);
  await Invoice.update(
    { status: 'overdue' },
    {
      where: {
        status: 'pending',
        generatedAt: { [Op.lt]: overdueThreshold }
      }
    }
  );

  const users = await User.findAll({
    where: { paymentMode: 'auto' },
    attributes: ['id']
  });
  let marked = 0;
  for (const u of users) {
    const hasCard = await PaymentMethod.findOne({ where: { userId: u.id }, attributes: ['id'] });
    if (!hasCard) continue;
    const [n] = await Invoice.update(
      { status: 'paid' },
      {
        where: {
          userId: u.id,
          status: { [Op.in]: ['pending', 'overdue'] },
          generatedAt: { [Op.gte]: todayStart, [Op.lt]: todayEnd }
        }
      }
    );
    marked += n;
  }

  const unpaidInvoices = await Invoice.findAll({
    where: { status: { [Op.in]: ['pending', 'overdue'] } },
    attributes: ['userId'],
    raw: true
  });
  const unpaidCountByUser = {};
  for (const inv of unpaidInvoices) {
    if (!inv.userId) continue;
    unpaidCountByUser[inv.userId] = (unpaidCountByUser[inv.userId] || 0) + 1;
  }
  const toDisable = Object.entries(unpaidCountByUser)
    .filter(([, count]) => count >= 2)
    .map(([userId]) => userId);
  if (toDisable.length > 0) {
    await User.update(
      { isActive: false },
      { where: { id: { [Op.in]: toDisable } } }
    );
  }
  return { usersProcessed: users.length, invoicesMarkedPaid: marked, usersDisabled: toDisable.length || 0 };
}

module.exports = {
  getPricingRules,
  calculateConsumptionCost,
  calculateHourlyCost,
  aggregateMetricsForVM,
  calculateInvoiceForPeriod,
  getFlavorSpecs,
  calculateSliceAmount,
  getLastSliceEnd,
  runBillingJobForSlice,
  runThirtyMinuteBillingJob,
  runDailyPaymentJob
};
