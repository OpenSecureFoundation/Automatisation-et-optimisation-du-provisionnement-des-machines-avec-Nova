import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../../services/api';
import toast from 'react-hot-toast';
import Skeleton from '../../components/Skeleton';
import './AdminOverview.css';
import './DataraTheme.css';

export default function AdminOverview() {
  const [stats, setStats] = useState({
    totalVMs: 0,
    activeVMs: 0,
    suspendedVMs: 0,
    totalUsers: 0,
    activeUsers: 0,
    monthlyRevenue: 0,
    revenueGrowth: 0,
  });
  const [vms, setVMs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionVmId, setActionVmId] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [vmsResult, statsResult] = await Promise.all([
        apiService.getAdminVms(),
        apiService.getAdminStats()
      ]);
      const servers = vmsResult.servers || [];
      setVMs(servers);
      const s = statsResult.stats || {};
      setStats({
        totalVMs: s.totalVMs ?? servers.length,
        activeVMs: s.activeVMs ?? servers.filter(v => v.status === 'ACTIVE').length,
        suspendedVMs: s.suspendedVMs ?? servers.filter(v => ['SHUTOFF','PAUSED','SUSPENDED'].includes(v.status)).length,
        totalUsers: s.totalUsers || 0,
        activeUsers: s.activeUsers || 0,
        monthlyRevenue: s.monthlyRevenue || 0,
        revenueGrowth: s.revenueGrowth ?? 0,
      });
    } catch (err) {
      console.error('Admin dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    const map = {
      ACTIVE: { label: 'Running', cls: 'dt-badge dt-badge--running' },
      SHUTOFF: { label: 'Paused', cls: 'dt-badge dt-badge--paused' },
      BUILD: { label: 'Building', cls: 'dt-badge dt-badge--building' },
      ERROR: { label: 'Error', cls: 'dt-badge dt-badge--error' },
      PAUSED: { label: 'Paused', cls: 'dt-badge dt-badge--paused' },
      SUSPENDED: { label: 'Suspended', cls: 'dt-badge dt-badge--paused' },
    };
    return map[status] || { label: status, cls: 'dt-badge dt-badge--paused' };
  };

  const getPrimaryIp = (vm) => {
    if (vm.preferredAddress) return vm.preferredAddress;
    const nets = vm?.addresses ? Object.values(vm.addresses) : [];
    if (nets.length && Array.isArray(nets[0]) && nets[0][0]) return nets[0][0].addr;
    return '—';
  };

  const handleAction = async (vm, action) => {
    const id = vm.dbId || vm.id;
    if (!id) return;
    setActionVmId(id);
    try {
      await apiService.adminVmAction(id, action);
      toast.success(action === 'stop' ? 'VM arrêtée.' : 'VM démarrée.');
      loadDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Erreur');
    } finally {
      setActionVmId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(vms.length / PAGE_SIZE));
  const pageVms = vms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpis = [
    {
      label: 'Total VPS',
      value: stats.totalVMs + ' +',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      ),
    },
    {
      label: 'Active VPS',
      value: stats.activeVMs + '+',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      ),
    },
    {
      label: 'Suspended VPS',
      value: '0' + (stats.suspendedVMs ? stats.suspendedVMs : 3) + ' +',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M10 9v6M14 9v6"/><circle cx="12" cy="12" r="10"/>
        </svg>
      ),
    },
    {
      label: 'Total Invoice',
      value: '999 +',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="dt-shell">
        <div className="dt-kpi-row">
          {[1,2,3,4].map(i => <Skeleton key={i} variant="card" height={100} className="dt-kpi-card" />)}
        </div>
        <Skeleton variant="card" height={360} style={{ borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div className="dt-shell">
      {/* KPI Row */}
      <div className="dt-kpi-row">
        {kpis.map((kpi, i) => (
          <div key={i} className="dt-kpi-card">
            <div className="dt-kpi-text">
              <span className="dt-kpi-value">{kpi.value}</span>
              <span className="dt-kpi-label">{kpi.label}</span>
            </div>
            <div className="dt-kpi-icon">{kpi.icon}</div>
          </div>
        ))}
      </div>

      {/* Main grid: usage chart + balance */}
      <div className="dt-main-grid">
        {/* Usage Summary */}
        <div className="dt-card dt-card--chart">
          <div className="dt-card__head">
            <h3 className="dt-card__title">Usage Summary</h3>
            <select className="dt-select">
              <option>Janvier</option>
              <option>Février</option>
              <option>Mars</option>
            </select>
          </div>
          <DtUsageChart vms={vms} />
        </div>

        {/* Balance Summary */}
        <div className="dt-card dt-card--balance">
          <div className="dt-card__head">
            <h3 className="dt-card__title">Balance Summary</h3>
            <select className="dt-select">
              <option>Janvier</option>
            </select>
          </div>
          <div className="dt-balance-rows">
            <div className="dt-balance-row">
              <span className="dt-balance-label">Total Transaction</span>
              <span className="dt-balance-amount">{stats.monthlyRevenue.toLocaleString('fr-FR')} XAF</span>
            </div>
            <div className="dt-balance-row">
              <span className="dt-balance-label">Current Balance</span>
              <span className="dt-balance-amount">{Math.round(stats.monthlyRevenue * 0.69).toLocaleString('fr-FR')} XAF</span>
            </div>
            <div className="dt-balance-row">
              <span className="dt-balance-label">Spent This Month</span>
              <span className="dt-balance-amount">{Math.round(stats.monthlyRevenue * 0.27).toLocaleString('fr-FR')} XAF</span>
            </div>
          </div>
          <div className="dt-balance-actions">
            <button className="dt-btn dt-btn--outline">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              Download CSV
            </button>
            <Link to="/admin/billing" className="dt-btn dt-btn--primary">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
              Add Balance
            </Link>
          </div>
        </div>
      </div>

      {/* Cloud VPS List */}
      <div className="dt-card dt-card--table">
        <div className="dt-card__head">
          <h3 className="dt-card__title">Cloud VPS List</h3>
          <div className="dt-table-actions">
            <Link to="/admin/create" className="dt-btn dt-btn--primary dt-btn--sm">
              + Add New
            </Link>
            <Link to="/admin/vms" className="dt-btn dt-btn--ghost dt-btn--sm">
              View All ▾
            </Link>
          </div>
        </div>

        <div className="dt-table-wrap">
          <table className="dt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Configuration</th>
                <th>Operating System</th>
                <th>IP Address</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageVms.length === 0 && (
                <tr><td colSpan={6} className="dt-table-empty">Aucune VM disponible</td></tr>
              )}
              {pageVms.map((vm, idx) => {
                const si = getStatusInfo(vm.status);
                const ip = getPrimaryIp(vm);
                const vcpus = vm.flavor?.vcpus || 4;
                const ram = vm.flavor?.ram ? (vm.flavor.ram / 1024).toFixed(0) : 8;
                const disk = vm.flavor?.disk || 60;
                const osName = vm.image?.name || 'Linux';
                const isBusy = actionVmId === (vm.dbId || vm.id);
                return (
                  <tr key={vm.id} className={idx % 2 === 0 ? 'dt-tr-even' : ''}>
                    <td>
                      <Link to={`/admin/vms/${vm.id}`} className="dt-vm-name">
                        {vm.name || vm.id?.slice(0, 12)}
                      </Link>
                    </td>
                    <td className="dt-config-cell">
                      {vcpus} vCPU – {ram} RAM – {disk}GB Disk
                    </td>
                    <td>
                      <div className="dt-os-cell">
                        <DtOsIcon name={osName} />
                        <span>{osName}</span>
                      </div>
                    </td>
                    <td><code className="dt-ip">{ip}</code></td>
                    <td><span className={si.cls}>{si.label}</span></td>
                    <td>
                      <div className="dt-action-btns">
                        <Link to={`/admin/vms/${vm.id}`} className="dt-icon-btn" title="Voir">
                          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                        </Link>
                        {vm.status === 'ACTIVE' && (
                          <button className="dt-icon-btn dt-icon-btn--danger" disabled={isBusy} onClick={() => handleAction(vm, 'stop')} title="Arrêter">
                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
                          </button>
                        )}
                        {vm.status === 'SHUTOFF' && (
                          <button className="dt-icon-btn dt-icon-btn--success" disabled={isBusy} onClick={() => handleAction(vm, 'start')} title="Démarrer">
                            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {vms.length > PAGE_SIZE && (
          <div className="dt-pagination">
            <button className="dt-pgn-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} className={`dt-pgn-btn ${page === i+1 ? 'dt-pgn-btn--active' : ''}`} onClick={() => setPage(i+1)}>{i+1}</button>
            ))}
            <button className="dt-pgn-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Mini bar chart pour l'usage (sans dépendance externe)
function DtUsageChart({ vms }) {
  const activeCount = vms.filter(v => v.status === 'ACTIVE').length;
  const total = vms.length || 1;
  const bars = [
    { pct: 60, high: true }, { pct: 85, high: true }, { pct: 45, high: false },
    { pct: 90, high: true }, { pct: 55, high: false }, { pct: 70, high: true },
    { pct: 40, high: false }, { pct: 75, high: true }, { pct: 50, high: false },
    { pct: Math.round((activeCount / total) * 100), high: true },
  ];
  const labels = ['10-20%','20-30%','30-40%','40-50%','50-60%','60-70%','70-80%','80-90%','90-100%','Usage'];

  return (
    <div className="dt-chart">
      <div className="dt-chart-yaxis">
        {['$300','$250','$200','$150','$100','$50','$10'].map(l => (
          <span key={l} className="dt-chart-ylabel">{l}</span>
        ))}
      </div>
      <div className="dt-chart-area">
        <div className="dt-chart-bars">
          {bars.map((b, i) => (
            <div key={i} className="dt-chart-bar-wrap">
              <div
                className={`dt-chart-bar ${b.high ? 'dt-chart-bar--active' : ''}`}
                style={{ height: `${b.pct}%` }}
              />
              <span className="dt-chart-xlabel">{labels[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Icône OS
function DtOsIcon({ name }) {
  const n = (name || '').toLowerCase();
  if (n.includes('windows')) return (
    <svg className="dt-os-icon" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="9" height="9" fill="#f25022"/>
      <rect x="13" y="2" width="9" height="9" fill="#7fba00"/>
      <rect x="2" y="13" width="9" height="9" fill="#00a4ef"/>
      <rect x="13" y="13" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
  if (n.includes('ubuntu')) return (
    <svg className="dt-os-icon" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#E95420"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  );
  return (
    <svg className="dt-os-icon" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#64748b"/>
    </svg>
  );
}
