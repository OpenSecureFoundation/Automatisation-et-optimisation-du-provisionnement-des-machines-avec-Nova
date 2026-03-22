const { ScalingPolicy, ScalingEvent, GlobalScaleUpRule, VM, User } = require('../models');
const openstack = require('../config/openstack');
const { Op } = require('sequelize');

const COOLDOWN_MINUTES = 5;

async function getProjectIdForInstance(instanceId) {
  const vm = await VM.findOne({ where: { instanceId }, include: [{ model: User, as: 'User', attributes: ['openstackProjectId'] }] });
  return vm?.User?.openstackProjectId || null;
}

async function isInCooldown(instanceId, cooldownMinutes = COOLDOWN_MINUTES) {
  const minutes = Number(cooldownMinutes);
  const effective = Number.isFinite(minutes) && minutes >= 0 ? minutes : COOLDOWN_MINUTES;
  const last = await ScalingEvent.findOne({
    where: { instanceId },
    order: [['timestamp', 'DESC']]
  });
  if (!last) return false;
  const elapsed = (Date.now() - new Date(last.timestamp).getTime()) / (60 * 1000);
  return elapsed < effective;
}

async function findNextFlavor(currentFlavorId, direction) {
  const data = await openstack.listFlavors();
  const flavors = (data.flavors || []).slice();
  flavors.sort((a, b) => (a.vcpus * 1024 + a.ram) - (b.vcpus * 1024 + b.ram));
  const idx = flavors.findIndex(f => f.id === currentFlavorId);
  if (idx < 0) return null;
  if (direction === 'up' && idx < flavors.length - 1) return flavors[idx + 1];
  if (direction === 'down' && idx > 0) return flavors[idx - 1];
  return null;
}

/** Find smallest flavor that has at least current + (deltaVcpus, deltaRamMb). */
async function findFlavorForScaleUp(currentFlavorId, deltaVcpus, deltaRamMb, projectId = null) {
  const data = await openstack.listFlavors();
  const flavors = (data.flavors || []).slice();
  let current;
  try {
    const res = await openstack.getFlavor(currentFlavorId, projectId);
    current = res.flavor || res;
  } catch (e) {
    return findNextFlavor(currentFlavorId, 'up');
  }
  const needVcpus = (current.vcpus || 1) + (deltaVcpus || 0);
  const needRam = (current.ram || 512) + (deltaRamMb || 0);
  const candidates = flavors.filter(
    f => f.vcpus >= needVcpus && f.ram >= needRam
  );
  if (candidates.length === 0) return findNextFlavor(currentFlavorId, 'up');
  candidates.sort((a, b) => (a.vcpus * 1024 + a.ram) - (b.vcpus * 1024 + b.ram));
  return candidates[0];
}

async function scaleUp(instanceId, policy, currentValue) {
  const cooldown = policy?.cooldownMinutes ?? COOLDOWN_MINUTES;
  if (await isInCooldown(instanceId, cooldown)) return;
  const projectId = await getProjectIdForInstance(instanceId);
  let server;
  try {
    server = await openstack.getServer(instanceId, projectId);
  } catch (e) {
    console.error('getServer failed:', e.message);
    return;
  }
  const sid = server.server?.id || server.id;
  const currentFlavorId = server.server?.flavor?.id || server.flavor?.id;
  const status = (server.server?.status || server.status || '').toUpperCase();
  if (['RESIZE', 'VERIFY_RESIZE', 'MIGRATING'].includes(status)) return;
  if (!currentFlavorId) return;

  let nextFlavor = null;
  const rule = await GlobalScaleUpRule.findOne({ where: { isActive: true } });
  if (rule) {
    nextFlavor = await findFlavorForScaleUp(
      currentFlavorId,
      rule.deltaVcpus,
      rule.deltaRamMb,
      projectId
    );
  }
  if (!nextFlavor) nextFlavor = await findNextFlavor(currentFlavorId, 'up');
  if (!nextFlavor) return;

  const triggerVal = typeof currentValue === 'object'
    ? (currentValue.cpu_util ?? currentValue.memory_usage ?? 0)
    : currentValue;
  try {
    await openstack.resizeServer(sid, nextFlavor.id, projectId);
    await ScalingEvent.create({
      instanceId: sid,
      action: 'resize_requested_up',
      oldFlavorId: currentFlavorId,
      newFlavorId: nextFlavor.id,
      triggerMetric: policy.metricType,
      triggerValue: triggerVal
    });
    console.log(`Scale up: ${sid} -> ${nextFlavor.name}`);
  } catch (err) {
    console.error('Scale up error:', err.message);
  }
}

async function scaleDown(instanceId, policy, currentValue) {
  const cooldown = policy?.cooldownMinutes ?? COOLDOWN_MINUTES;
  if (await isInCooldown(instanceId, cooldown)) return;
  const projectId = await getProjectIdForInstance(instanceId);
  let server;
  try {
    server = await openstack.getServer(instanceId, projectId);
  } catch (e) {
    console.error('getServer failed:', e.message);
    return;
  }
  const sid = server.server?.id || server.id;
  const currentFlavorId = server.server?.flavor?.id || server.flavor?.id;
  const status = (server.server?.status || server.status || '').toUpperCase();
  if (['RESIZE', 'VERIFY_RESIZE', 'MIGRATING'].includes(status)) return;
  if (!currentFlavorId) return;

  let nextFlavor = null;
  if (policy.baseFlavorId && policy.baseFlavorId !== currentFlavorId) {
    try {
      const res = await openstack.getFlavor(policy.baseFlavorId, projectId);
      nextFlavor = res.flavor || res;
    } catch (e) {
      // fallback to findNextFlavor
    }
  }
  if (!nextFlavor) nextFlavor = await findNextFlavor(currentFlavorId, 'down');
  if (!nextFlavor) return;

  const triggerVal = typeof currentValue === 'object'
    ? (currentValue.cpu_util ?? currentValue.memory_usage ?? 0)
    : currentValue;
  try {
    await openstack.resizeServer(sid, nextFlavor.id, projectId);
    await ScalingEvent.create({
      instanceId: sid,
      action: 'resize_requested_down',
      oldFlavorId: currentFlavorId,
      newFlavorId: nextFlavor.id,
      triggerMetric: policy.metricType,
      triggerValue: triggerVal
    });
    console.log(`Scale down: ${sid} -> ${nextFlavor.name}`);
  } catch (err) {
    console.error('Scale down error:', err.message);
  }
}

class AutoScaler {
  async update(instanceId, metricType, currentValue, policy) {
    if (!policy || !policy.isActive) return;
    const high = Number(policy.thresholdHigh);
    const low = Number(policy.thresholdLow);

    let shouldScaleUp = false;
    let shouldScaleDown = false;
    if (metricType === 'cpu_and_memory' && typeof currentValue === 'object') {
      const cpu = Number(currentValue.cpu_util) || 0;
      const mem = Number(currentValue.memory_usage) || 0;
      shouldScaleUp = cpu >= high || mem >= high;
      shouldScaleDown = cpu <= low && mem <= low;
    } else {
      const v = Number(currentValue);
      shouldScaleUp = v >= high;
      shouldScaleDown = v <= low;
    }

    if (shouldScaleUp) {
      await scaleUp(instanceId, policy, currentValue);
    } else if (shouldScaleDown) {
      await scaleDown(instanceId, policy, currentValue);
    }
  }
}

module.exports = { AutoScaler, scaleUp, scaleDown, isInCooldown, findNextFlavor };
