const { ScalingPolicy, ScalingEvent, VM } = require('../models');
const metricsQueryService = require('../services/metricsQueryService');

async function ensureVmOwnership(req, res) {
  const paramId = req.params.id;
  if (!paramId || !req.userId) {
    res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    return null;
  }
  let vm = await VM.findOne({ where: { instanceId: paramId, userId: req.userId } });
  if (!vm) vm = await VM.findOne({ where: { id: paramId, userId: req.userId } });
  if (!vm) {
    res.status(404).json({ error: { message: 'VM not found', status: 404 } });
    return null;
  }
  req.vmInstanceId = vm.instanceId;
  return vm;
}

async function getScalingPolicy(req, res, next) {
  try {
    if (await ensureVmOwnership(req, res) === null) return;
    const instanceId = req.vmInstanceId;
    const policy = await ScalingPolicy.findOne({
      where: { instanceId, isActive: true }
    });
    if (!policy) {
      return res.status(404).json({
        error: { message: 'No scaling policy for this VM', status: 404 }
      });
    }
    res.json({
      success: true,
      policy: {
        id: policy.id,
        instanceId: policy.instanceId,
        metricType: policy.metricType,
        thresholdHigh: Number(policy.thresholdHigh),
        thresholdLow: Number(policy.thresholdLow),
        actionType: policy.actionType,
        isActive: policy.isActive,
        cooldownMinutes: policy.cooldownMinutes,
        baseFlavorId: policy.baseFlavorId || null
      }
    });
  } catch (err) {
    next(err);
  }
}

async function putScalingPolicy(req, res, next) {
  try {
    const vm = await ensureVmOwnership(req, res);
    if (vm === null) return;
    const instanceId = req.vmInstanceId;
    const { metricType, thresholdHigh, thresholdLow, isActive, cooldownMinutes, baseFlavorId } = req.body;
    const allowedMetricTypes = new Set([
      'cpu_util',
      'memory_usage',
      'disk_usage',
      'network_incoming_bytes',
      'network_outgoing_bytes',
      'cpu_and_memory'
    ]);
    const highNum = thresholdHigh != null ? Number(thresholdHigh) : null;
    const lowNum = thresholdLow != null ? Number(thresholdLow) : null;
    const cooldownNum = cooldownMinutes != null ? Number(cooldownMinutes) : null;
    const metricToUse = metricType || 'cpu_util';
    if (!allowedMetricTypes.has(metricToUse)) {
      return res.status(400).json({ error: { message: 'Invalid metricType', status: 400 } });
    }
    if (highNum != null && (!Number.isFinite(highNum) || highNum < 0 || highNum > 100)) {
      return res.status(400).json({ error: { message: 'thresholdHigh must be between 0 and 100', status: 400 } });
    }
    if (lowNum != null && (!Number.isFinite(lowNum) || lowNum < 0 || lowNum > 100)) {
      return res.status(400).json({ error: { message: 'thresholdLow must be between 0 and 100', status: 400 } });
    }
    if (cooldownNum != null && (!Number.isInteger(cooldownNum) || cooldownNum < 0 || cooldownNum > 1440)) {
      return res.status(400).json({ error: { message: 'cooldownMinutes must be an integer between 0 and 1440', status: 400 } });
    }

    let policy = await ScalingPolicy.findOne({ where: { instanceId } });
    const effectiveHigh = highNum != null ? highNum : Number(policy?.thresholdHigh ?? 80);
    const effectiveLow = lowNum != null ? lowNum : Number(policy?.thresholdLow ?? 20);
    if (effectiveHigh < effectiveLow) {
      return res.status(400).json({ error: { message: 'thresholdHigh must be >= thresholdLow', status: 400 } });
    }
    if (policy) {
      const updates = {
        metricType: metricType ?? policy.metricType,
        thresholdHigh: thresholdHigh ?? policy.thresholdHigh,
        thresholdLow: thresholdLow ?? policy.thresholdLow,
        isActive: isActive !== undefined ? isActive : policy.isActive,
        cooldownMinutes: cooldownMinutes ?? policy.cooldownMinutes
      };
      if (baseFlavorId !== undefined) updates.baseFlavorId = baseFlavorId || null;
      else if (!policy.baseFlavorId) updates.baseFlavorId = vm.flavorId;
      await policy.update(updates);
    } else {
      policy = await ScalingPolicy.create({
        instanceId,
        metricType: metricType || 'cpu_util',
        thresholdHigh: thresholdHigh ?? 80,
        thresholdLow: thresholdLow ?? 20,
        isActive: isActive !== false,
        cooldownMinutes: cooldownMinutes ?? 5,
        baseFlavorId: baseFlavorId ?? vm.flavorId ?? null
      });
    }
    res.json({
      success: true,
      policy: {
        id: policy.id,
        instanceId: policy.instanceId,
        metricType: policy.metricType,
        thresholdHigh: Number(policy.thresholdHigh),
        thresholdLow: Number(policy.thresholdLow),
        isActive: policy.isActive,
        cooldownMinutes: policy.cooldownMinutes,
        baseFlavorId: policy.baseFlavorId || null
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getMetrics(req, res, next) {
  try {
    const vm = await ensureVmOwnership(req, res);
    if (vm === null) return;
    const instanceId = req.vmInstanceId;
    const projectId = req.user?.openstackProjectId || null;
    const { metrics, source } = await metricsQueryService.getMergedMetricsForVm(vm, projectId);
    res.json({ success: true, metrics, instanceId, source });
  } catch (err) {
    next(err);
  }
}

async function getScalingHistory(req, res, next) {
  try {
    if (await ensureVmOwnership(req, res) === null) return;
    const instanceId = req.vmInstanceId;
    const events = await ScalingEvent.findAll({
      where: { instanceId },
      order: [['timestamp', 'DESC']],
      limit: 50
    });
    res.json({
      success: true,
      history: events.map(e => ({
        id: e.id,
        action: e.action,
        oldFlavorId: e.oldFlavorId,
        newFlavorId: e.newFlavorId,
        triggerMetric: e.triggerMetric,
        triggerValue: e.triggerValue ? Number(e.triggerValue) : null,
        timestamp: e.timestamp
      }))
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getScalingPolicy,
  putScalingPolicy,
  getMetrics,
  getScalingHistory
};
