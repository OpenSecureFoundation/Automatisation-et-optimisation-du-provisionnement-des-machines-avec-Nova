const { User, Invoice, VM, VmRuntime } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const openstack = require('../config/openstack');
const vmService = require('../services/vmService');
const metricsQueryService = require('../services/metricsQueryService');

// Helper: include User avec alias cohérent
const includeUser = { model: User, as: 'User', attributes: ['id', 'email', 'name', 'openstackProjectId'] };

async function getStats(req, res, next) {
  try {
    logger.info('Admin: get stats');

    const totalUsers = await User.count();

    const [vmsUsers, invoicesUsers] = await Promise.all([
      VM.findAll({ attributes: ['userId'], raw: true }),
      Invoice.findAll({ attributes: ['userId'], raw: true })
    ]);
    const activeUsersSet = new Set();
    vmsUsers.forEach(v => activeUsersSet.add(v.userId));
    invoicesUsers.forEach(i => activeUsersSet.add(i.userId));
    const activeUsers = activeUsersSet.size;

    const totalVMs = await VM.count();
    const activeVMs = await VM.count({ where: { status: 'ACTIVE' } });
    const suspendedVMs = await VM.count({
      where: { status: { [Op.in]: ['SHUTOFF', 'PAUSED', 'SUSPENDED'] } }
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthlyRevenueResult = await Invoice.sum('totalAmount', {
      where: {
        status: 'paid',
        [Op.or]: [
          { periodStart: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] } },
          { periodEnd:   { [Op.between]: [firstDayOfMonth, lastDayOfMonth] } }
        ]
      }
    });
    const monthlyRevenue = Number(monthlyRevenueResult || 0);

    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth  = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const prevMonthRevenueResult = await Invoice.sum('totalAmount', {
      where: {
        status: 'paid',
        [Op.or]: [
          { periodStart: { [Op.between]: [firstDayPrevMonth, lastDayPrevMonth] } },
          { periodEnd:   { [Op.between]: [firstDayPrevMonth, lastDayPrevMonth] } }
        ]
      }
    });
    const prevMonthRevenue = Number(prevMonthRevenueResult || 0);

    const revenueGrowth = prevMonthRevenue > 0
      ? ((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue * 100).toFixed(1)
      : monthlyRevenue > 0 ? '100.0' : '0.0';

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalVMs,
        activeVMs,
        suspendedVMs,
        monthlyRevenue,
        revenueGrowth: parseFloat(revenueGrowth)
      }
    });
  } catch (err) {
    logger.error('Admin stats error:', err.message);
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    logger.info('Admin: list users');
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = search.trim();

    const where = {};
    if (searchTerm) {
      where[Op.or] = [
        { email: { [Op.like]: `%${searchTerm}%` } },
        { name:  { [Op.like]: `%${searchTerm}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'updatedAt']
    });

    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const [vmCount, invoiceCount] = await Promise.all([
          VM.count({ where: { userId: user.id } }),
          Invoice.count({ where: { userId: user.id } })
        ]);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive !== false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          vmCount,
          invoiceCount
        };
      })
    );

    res.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) {
    logger.error('Admin list users error:', err.message);
    next(err);
  }
}

async function listAllVms(req, res, next) {
  try {
    logger.info('Admin: list all VMs');
    const vms = await VM.findAll({
      order: [['createdAt', 'DESC']],
      include: [includeUser]
    });
    const servers = await Promise.all(
      vms.map(async (vm) => {
        const projectId = vm.User?.openstackProjectId || null;
        const server = await vmService.buildServerView(vm, projectId);
        return {
          ...server,
          userId:    vm.userId,
          userEmail: vm.User?.email
        };
      })
    );
    res.json({ success: true, count: servers.length, servers });
  } catch (err) {
    logger.error('Admin list all VMs error:', err.message);
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (id === req.userId) {
      return res.status(400).json({ error: { message: 'Vous ne pouvez pas désactiver votre propre compte.', status: 400 } });
    }
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: { message: 'Utilisateur introuvable', status: 404 } });
    }
    if (typeof isActive === 'boolean') {
      user.isActive = isActive;
      await user.save();
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive !== false
      }
    });
  } catch (err) {
    logger.error('Admin update user error:', err.message);
    next(err);
  }
}

async function getVmDetail(req, res, next) {
  try {
    const { id } = req.params;
    const vm = await vmService.findVmAny(id, true);
    if (!vm) {
      return res.status(404).json({ error: { message: 'VM introuvable', status: 404 } });
    }
    const projectId = vm.User?.openstackProjectId || null;
    const server = await vmService.getDetailedServerView(vm, projectId, true);
    res.json({ success: true, server });
  } catch (err) {
    logger.error('Admin get VM detail error:', err.message);
    next(err);
  }
}

async function getVmConsole(req, res, next) {
  try {
    const { id } = req.params;
    const vm = await vmService.findVmAny(id, true);
    if (!vm) {
      return res.status(404).json({ error: { message: 'VM introuvable', status: 404, code: 'VM_NOT_FOUND' } });
    }
    const projectId = vm.User?.openstackProjectId || null;
    let url;
    try {
      url = await openstack.getConsoleUrl(vm.instanceId, projectId);
    } catch (osErr) {
      if (osErr.response?.status === 404) {
        return res.status(503).json({
          error: { message: 'Console non disponible pour cette VM.', status: 503, code: 'CONSOLE_UNAVAILABLE' }
        });
      }
      throw osErr;
    }
    if (!url) {
      return res.status(503).json({ error: { message: 'Console non disponible pour cette VM', status: 503 } });
    }
    res.json({ success: true, url });
  } catch (err) {
    logger.error('Admin VM console error:', err.message);
    next(err);
  }
}

async function vmAction(req, res, next) {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const allowed = ['stop', 'start', 'reboot'];
    if (!action || !allowed.includes(action)) {
      return res.status(400).json({
        error: { message: 'Action invalide. Utilisez: stop, start, reboot', status: 400 }
      });
    }
    const vm = await vmService.findVmAny(id, true);
    if (!vm) {
      return res.status(404).json({ error: { message: 'VM introuvable', status: 404 } });
    }
    const projectId = vm.User?.openstackProjectId || null;
    const actionBody = action === 'stop'   ? { 'os-stop': null }
                     : action === 'start'  ? { 'os-start': null }
                     : { reboot: { type: 'SOFT' } };
    await openstack.serverAction(vm.instanceId, actionBody, projectId);
    logger.info('Admin VM action', { action, instanceId: vm.instanceId });
    res.json({ success: true, message: `VM ${action === 'stop' ? 'arrêtée' : action === 'start' ? 'démarrée' : 'redémarrée'}.` });
  } catch (err) {
    if (err.response?.status === 409) {
      return res.status(409).json({
        error: { message: 'Action impossible dans l\'état actuel de la VM.', status: 409 }
      });
    }
    logger.error('Admin VM action error:', err.message);
    next(err);
  }
}

async function deleteVm(req, res, next) {
  try {
    const { id } = req.params;
    const vm = await vmService.findVmAny(id, true);
    if (!vm) {
      return res.status(404).json({ error: { message: 'VM introuvable', status: 404 } });
    }
    const projectId = vm.User?.openstackProjectId || null;
    try {
      await openstack.deleteServer(vm.instanceId, projectId);
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }

    await VmRuntime.update(
      { stoppedAt: new Date() },
      { where: { instanceId: vm.instanceId, userId: vm.userId, stoppedAt: null } }
    );

    await vm.destroy();
    res.json({ success: true, message: 'VM supprimée avec succès.' });
  } catch (err) {
    logger.error('Admin delete VM error:', err.message);
    next(err);
  }
}

async function getLatestMetricsSnapshot(req, res, next) {
  try {
    const vms = await VM.findAll({
      order: [['createdAt', 'DESC']],
      include: [includeUser]
    });
    const rows = await Promise.all(vms.map(async (vm) => {
      const projectId = vm.User?.openstackProjectId || null;
      const { latest, source } = await metricsQueryService.getLatestMetricsForVm(vm, projectId);
      return {
        vmId:       vm.id,
        instanceId: vm.instanceId,
        userId:     vm.userId,
        userEmail:  vm.User?.email || null,
        latest,
        source
      };
    }));
    res.json({ success: true, count: rows.length, items: rows });
  } catch (err) {
    logger.error('Admin latest metrics snapshot error:', err.message);
    next(err);
  }
}

module.exports = {
  getStats,
  listUsers,
  listAllVms,
  getVmDetail,
  getVmConsole,
  updateUser,
  vmAction,
  deleteVm,
  getLatestMetricsSnapshot
};
