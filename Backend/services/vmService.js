const { Op } = require('sequelize');
const { VM, User } = require('../models');
const openstack = require('../config/openstack');

function normalizeVmParam(paramId) {
  if (!paramId || typeof paramId !== 'string') return paramId;
  return paramId.trim();
}

function getPreferredAddress(server) {
  const s = server || {};
  if (s.accessIPv4 && String(s.accessIPv4).trim()) return String(s.accessIPv4).trim();
  const addrs = s.addresses && typeof s.addresses === 'object' ? s.addresses : {};
  const networkNames = Object.keys(addrs);
  const preferred = networkNames.find(n => /public|floating|ext|external/i.test(n));
  if (preferred && Array.isArray(addrs[preferred]) && addrs[preferred].length > 0) {
    const first = addrs[preferred].find(a => a.version === 4 || a.addr);
    if (first?.addr) return first.addr;
  }
  for (const name of networkNames) {
    const list = addrs[name];
    if (Array.isArray(list) && list.length > 0 && list[0].addr) return list[0].addr;
  }
  return null;
}

async function enrichFlavorAndImage(server, vm, projectId) {
  const out = { ...server };
  const flavorId = out.flavor?.id || out.flavorId || vm?.flavorId;
  if (flavorId) {
    try {
      const flavorData = await openstack.getFlavor(flavorId, projectId);
      out.flavor = flavorData.flavor || flavorData;
    } catch { /* keep existing */ }
  }
  const imageId = out.image?.id || (typeof out.image === 'string' ? out.image : null);
  if (imageId) {
    try {
      const imageData = await openstack.getImage(imageId);
      const img = imageData.image || imageData;
      out.image = { id: imageId, name: img.name || img.display_name || null };
    } catch {
      out.image = out.image && typeof out.image === 'object' ? out.image : { id: imageId, name: null };
    }
  }
  return out;
}

async function buildServerView(vm, projectId) {
  try {
    const data = await openstack.getServer(vm.instanceId, projectId);
    const raw = data.server || data;
    const updates = {};
    if (raw.status && raw.status !== vm.status) updates.status = raw.status;
    if (raw.name   && raw.name   !== vm.name)   updates.name   = raw.name;
    if (Object.keys(updates).length) vm.update(updates).catch(() => {});
    const base = { ...raw, dbId: vm.id, flavorId: vm.flavorId, expiresAt: vm.expiresAt };
    base.preferredAddress = getPreferredAddress(base);
    return base;
  } catch {
    return {
      id: vm.instanceId,
      name: vm.name || vm.instanceId,
      status: vm.status || 'UNKNOWN',
      dbId: vm.id,
      flavorId: vm.flavorId,
      expiresAt: vm.expiresAt,
      preferredAddress: null
    };
  }
}

async function getDetailedServerView(vm, projectId, includeOwner = false) {
  const server   = await buildServerView(vm, projectId);
  const enriched = await enrichFlavorAndImage(server, vm, projectId);
  if (includeOwner && vm.User) {
    enriched.owner = { id: vm.User.id, email: vm.User.email, name: vm.User.name };
  }
  return enriched;
}

async function findVmForUser(paramId, userId) {
  const id = normalizeVmParam(paramId);
  if (!id || !userId) return null;
  let vm = await VM.findOne({ where: { instanceId: id, userId } });
  if (!vm) vm = await VM.findOne({ where: { id, userId } });
  return vm;
}

/**
 * Trouve une VM par instanceId ou dbId, toutes propriétés.
 * withOwner=true inclut le User avec l'alias 'User' (cohérent avec models/index.js)
 */
async function findVmAny(paramId, withOwner = false) {
  const id = normalizeVmParam(paramId);
  if (!id) return null;
  const where = { [Op.or]: [{ instanceId: id }, { id }] };
  if (!withOwner) return VM.findOne({ where });
  return VM.findOne({
    where,
    include: [{
      model: User,
      as: 'User',  // CORRIGÉ: cohérent avec l'association définie dans models/index.js
      attributes: ['id', 'openstackProjectId', 'email', 'name']
    }]
  });
}

module.exports = {
  normalizeVmParam,
  getPreferredAddress,
  findVmForUser,
  findVmAny,
  buildServerView,
  getDetailedServerView
};
