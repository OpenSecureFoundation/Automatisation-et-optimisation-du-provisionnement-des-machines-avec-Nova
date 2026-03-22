import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api';
import Skeleton from '../../components/Skeleton';
import toast from 'react-hot-toast';
import './ClientOverview.css';

const STATUS_MAP = {
  ACTIVE:    { label: 'Running',  badgeCls: 'cl-badge--running',  dotCls: 'cl-vm-dot--active'  },
  SHUTOFF:   { label: 'Stopped',  badgeCls: 'cl-badge--stopped',  dotCls: 'cl-vm-dot--stopped' },
  BUILD:     { label: 'Building', badgeCls: 'cl-badge--building', dotCls: 'cl-vm-dot--build'   },
  ERROR:     { label: 'Error',    badgeCls: 'cl-badge--error',    dotCls: 'cl-vm-dot--error'   },
  PAUSED:    { label: 'Paused',   badgeCls: 'cl-badge--paused',   dotCls: 'cl-vm-dot--stopped' },
  SUSPENDED: { label: 'Suspended',badgeCls: 'cl-badge--paused',   dotCls: 'cl-vm-dot--stopped' },
};

function statusInfo(s) {
  return STATUS_MAP[s] || { label: s || '—', badgeCls: 'cl-badge--stopped', dotCls: 'cl-vm-dot--stopped' };
}

export default function ClientOverview() {
  const { user } = useAuth();
  const [vms, setVMs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]   = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiService.getVMs();
      setVMs(res.servers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeVMs   = vms.filter(v => v.status === 'ACTIVE').length;
  const stoppedVMs  = vms.filter(v => v.status === 'SHUTOFF').length;
  const buildingVMs = vms.filter(v => v.status === 'BUILD').length;
  const errorVMs    = vms.filter(v => v.status === 'ERROR').length;

  const kpis = [
    {
      value: vms.length + ' +',
      label: 'Total VPS',
      trend: vms.length > 0 ? `+${activeVMs} actif${activeVMs > 1 ? 's' : ''}` : '—',
      iconBg: '#eff4ff', iconColor: '#3b6ef6',
      icon: <path d="M5.5 5a3 3 0 016 0v1h3a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h.5V5zM9 5a1 1 0 012 0v1H9V5zm-1 7a1 1 0 112 0v2a1 1 0 11-2 0v-2z"/>,
    },
    {
      value: activeVMs + ' +',
      label: 'VPS Actifs',
      trend: vms.length ? `${Math.round(activeVMs / vms.length * 100)}% du parc` : '—',
      iconBg: '#f0fdf4', iconColor: '#22c55e',
      icon: <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>,
    },
    {
      value: stoppedVMs + ' +',
      label: 'VPS Arrêtés',
      trend: stoppedVMs > 0 ? 'En pause' : 'Tous opérationnels',
      trendNeutral: true,
      iconBg: '#fef9c3', iconColor: '#ca8a04',
      icon: <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd"/>,
    },
    {
      value: (buildingVMs + errorVMs) + ' +',
      label: 'En Construction',
      trend: buildingVMs > 0 ? `${buildingVMs} en déploiement` : 'Aucune en attente',
      trendNeutral: true,
      iconBg: '#fdf2f8', iconColor: '#db2777',
      icon: <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>,
    },
  ];

  const totalPages = Math.max(1, Math.ceil(vms.length / PAGE_SIZE));
  const pageVMs = vms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getPrimaryIp = (vm) => {
    if (vm.preferredAddress) return vm.preferredAddress;
    const nets = vm?.addresses ? Object.values(vm.addresses) : [];
    if (nets.length && Array.isArray(nets[0]) && nets[0][0]) return nets[0][0].addr;
    return null;
  };

  const statusCounts = [
    { label: 'Actifs',      count: activeVMs,   color: '#22c55e', dotCls: 'cl-vm-dot--active' },
    { label: 'Arrêtés',     count: stoppedVMs,  color: '#94a3b8', dotCls: 'cl-vm-dot--stopped' },
    { label: 'En création', count: buildingVMs, color: '#f59e0b', dotCls: 'cl-vm-dot--build' },
    { label: 'Erreur',      count: errorVMs,    color: '#ef4444', dotCls: 'cl-vm-dot--error' },
  ].filter(s => s.count > 0 || s.label === 'Actifs');

  if (loading) {
    return (
      <div className="cl-shell">
        <div className="cl-kpi-row">
          {[1,2,3,4].map(i => <Skeleton key={i} variant="card" height={96} style={{ borderRadius: 14 }} />)}
        </div>
        <div className="cl-main-grid">
          <Skeleton variant="card" height={360} style={{ borderRadius: 16 }} />
          <Skeleton variant="card" height={360} style={{ borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="cl-shell">
      {/* ── KPI Row ── */}
      <div className="cl-kpi-row">
        {kpis.map((k, i) => (
          <div key={i} className="cl-kpi-card">
            <div className="cl-kpi-text">
              <span className="cl-kpi-value">{k.value}</span>
              <span className="cl-kpi-label">{k.label}</span>
              <span className={`cl-kpi-trend ${k.trendNeutral ? 'cl-kpi-trend--neutral' : ''}`}>{k.trend}</span>
            </div>
            <div className="cl-kpi-icon" style={{ background: k.iconBg, color: k.iconColor }}>
              <svg viewBox="0 0 20 20" fill="currentColor">{k.icon}</svg>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="cl-main-grid">
        {/* VPS List */}
        <div className="cl-card">
          <div className="cl-card__head">
            <h3 className="cl-card__title">Cloud VPS List</h3>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <Link to="/client/create" className="cl-btn cl-btn--primary cl-btn--sm">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
                Add New
              </Link>
              <button className="cl-btn cl-btn--ghost cl-btn--sm" onClick={loadData}>⟳ Refresh</button>
            </div>
          </div>

          {vms.length === 0 ? (
            <div className="cl-empty">
              <div className="cl-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                </svg>
              </div>
              <h3>Aucune machine virtuelle</h3>
              <p>Déployez votre premier VPS en quelques secondes.</p>
              <Link to="/client/create" className="cl-btn cl-btn--primary">Créer ma première VM</Link>
            </div>
          ) : (
            <>
              <div className="cl-table-wrap">
                <table className="cl-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Configuration</th>
                      <th>IP Address</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageVMs.map(vm => {
                      const si = statusInfo(vm.status);
                      const ip = getPrimaryIp(vm);
                      const vcpus = vm.flavor?.vcpus || '—';
                      const ram = vm.flavor?.ram ? `${(vm.flavor.ram/1024).toFixed(0)}GB` : '—';
                      const disk = vm.flavor?.disk ? `${vm.flavor.disk}GB` : '—';
                      return (
                        <tr key={vm.id}>
                          <td>
                            <Link to={`/client/vms/${vm.id}`} className="cl-vm-name">
                              <span className={`cl-vm-dot ${si.dotCls}`} />
                              {vm.name || vm.id?.slice(0, 12)}
                            </Link>
                          </td>
                          <td style={{ fontSize: '.8rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {vcpus} vCPU – {ram} RAM – {disk}
                          </td>
                          <td>
                            {ip
                              ? <code style={{ fontSize: '.78rem', background: '#f1f5f9', padding: '.15rem .4rem', borderRadius: 5 }}>{ip}</code>
                              : <span style={{ color: '#94a3b8', fontSize: '.78rem' }}>—</span>}
                          </td>
                          <td><span className={`cl-badge ${si.badgeCls}`}>{si.label}</span></td>
                          <td>
                            <VmActions vm={vm} onRefresh={loadData} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {vms.length > PAGE_SIZE && (
                <div className="cl-pagination">
                  <button className="cl-pgn-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i} className={`cl-pgn-btn ${page===i+1?'cl-pgn-btn--active':''}`} onClick={() => setPage(i+1)}>{i+1}</button>
                  ))}
                  <button className="cl-pgn-btn" disabled={page>=totalPages} onClick={() => setPage(p=>p+1)}>›</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Status summary */}
          <div className="cl-card cl-stats-card">
            <div className="cl-card__head" style={{ padding: '0 0 .75rem' }}>
              <h3 className="cl-card__title">Répartition</h3>
            </div>
            {statusCounts.map((s, i) => (
              <div key={i} className="cl-stat-row">
                <div className="cl-stat-info">
                  <span className={`cl-stat-dot ${s.dotCls}`} style={{ background: s.color }} />
                  <div>
                    <div className="cl-stat-name">{s.label}</div>
                    <div className="cl-stat-meta">{s.count} machine{s.count > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <span className="cl-stat-count">{s.count}</span>
              </div>
            ))}
            {vms.length === 0 && <p style={{ fontSize: '.82rem', color: '#94a3b8', margin: '.5rem 0 0' }}>Aucune VM</p>}
          </div>

          {/* Recent activity */}
          <div className="cl-card">
            <div className="cl-card__head">
              <h3 className="cl-card__title">Activité récente</h3>
              <Link to="/client/vms" className="cl-card__link">Voir tout</Link>
            </div>
            <ul className="cl-activity-list">
              {vms.length === 0 && (
                <li style={{ padding: '.5rem 0', fontSize: '.82rem', color: '#94a3b8' }}>Aucune activité</li>
              )}
              {[...vms]
                .sort((a, b) => new Date(b.created || b.createdAt || 0) - new Date(a.created || a.createdAt || 0))
                .slice(0, 5)
                .map((vm, i) => {
                  const si = statusInfo(vm.status);
                  const initials = (vm.name || 'VM').slice(0, 2).toUpperCase();
                  const date = vm.created || vm.createdAt
                    ? new Date(vm.created || vm.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                    : '—';
                  return (
                    <li key={vm.id} className="cl-activity-item" style={{ animationDelay: `${i * .06}s` }}>
                      <div className="cl-activity-avatar">{initials}</div>
                      <div className="cl-activity-content">
                        <div className="cl-activity-name">{vm.name || vm.id?.slice(0, 10)}</div>
                        <div className="cl-activity-meta">{si.label} · {date}</div>
                      </div>
                      <Link to={`/client/vms/${vm.id}`} className="cl-activity-link">Voir →</Link>
                    </li>
                  );
                })}
            </ul>
          </div>

          {/* Quick actions */}
          <div className="cl-card" style={{ padding: '1.1rem 1.4rem' }}>
            <h3 className="cl-card__title" style={{ marginBottom: '1rem' }}>Actions rapides</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              <Link to="/client/create" className="cl-btn cl-btn--primary" style={{ justifyContent: 'center' }}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
                Créer une VM
              </Link>
              <Link to="/client/marketplace" className="cl-btn cl-btn--outline" style={{ justifyContent: 'center' }}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/></svg>
                Marketplace
              </Link>
              <Link to="/client/billing" className="cl-btn cl-btn--ghost" style={{ justifyContent: 'center' }}>
                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                Facturation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Inline action buttons for each VM row */
function VmActions({ vm, onRefresh }) {
  const [busy, setBusy] = useState(null);

  const doAction = async (action) => {
    setBusy(action);
    try {
      if (action === 'delete') {
        await apiService.deleteVM(vm.id);
        toast.success('VM supprimée');
      } else {
        await apiService.vmAction(vm.id, action);
        toast.success(action === 'start' ? 'Démarrage…' : action === 'stop' ? 'Arrêt…' : 'Redémarrage…');
      }
      setTimeout(onRefresh, 1000);
    } catch (e) {
      toast.error(e.response?.data?.error?.message || 'Erreur');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="cl-actions">
      <Link to={`/client/vms/${vm.id}`} className="cl-icon-btn" title="Voir détails">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
      </Link>
      {vm.status === 'SHUTOFF' && (
        <button className="cl-icon-btn cl-icon-btn--success" title="Démarrer" disabled={!!busy} onClick={() => doAction('start')}>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
        </button>
      )}
      {vm.status === 'ACTIVE' && (
        <button className="cl-icon-btn cl-icon-btn--warn" title="Arrêter" disabled={!!busy} onClick={() => doAction('stop')}>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
        </button>
      )}
      <button className="cl-icon-btn cl-icon-btn--danger" title="Supprimer" disabled={!!busy} onClick={() => doAction('delete')}>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
      </button>
    </div>
  );
}
