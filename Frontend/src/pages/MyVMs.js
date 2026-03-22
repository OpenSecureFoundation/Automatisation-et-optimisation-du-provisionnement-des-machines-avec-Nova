import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import apiService from '../services/api';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { ConfirmModal } from '../components';
import '../pages/client/ClientOverview.css';
import '../pages/admin/DataraServer.css';

const STATUS_MAP = {
  ACTIVE:    { label: 'Active',    badgeCls: 'cl-badge--running', dsCls: 'ds-badge--active',     dotCls: 'cl-vm-dot--active'  },
  SHUTOFF:   { label: 'Stopped',   badgeCls: 'cl-badge--stopped', dsCls: 'ds-badge--unavailable', dotCls: 'cl-vm-dot--stopped' },
  BUILD:     { label: 'Building',  badgeCls: 'cl-badge--building',dsCls: 'ds-badge--building',    dotCls: 'cl-vm-dot--build'   },
  ERROR:     { label: 'Error',     badgeCls: 'cl-badge--error',   dsCls: 'ds-badge--unavailable', dotCls: 'cl-vm-dot--error'   },
  PAUSED:    { label: 'Paused',    badgeCls: 'cl-badge--paused',  dsCls: 'ds-badge--paused',      dotCls: 'cl-vm-dot--stopped' },
  SUSPENDED: { label: 'Suspended', badgeCls: 'cl-badge--paused',  dsCls: 'ds-badge--paused',      dotCls: 'cl-vm-dot--stopped' },
};

function si(s) { return STATUS_MAP[s] || { label: s || '—', badgeCls: 'cl-badge--stopped', dsCls: 'ds-badge--paused', dotCls: 'cl-vm-dot--stopped' }; }

const PAGE_SIZE = 6;

export default function MyVMs() {
  const location = useLocation();
  const isClient = location.pathname.startsWith('/client');
  const basePath = isClient ? '/client' : '/admin';

  const [vms, setVMs]          = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(null);
  const [busy, setBusy]        = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [page, setPage]        = useState(1);
  const [tab, setTab]          = useState('purchased');

  useEffect(() => { loadVMs(); }, []);

  // Auto-refresh while any VM is building
  const hasBuilding = vms.some(v => v.status === 'BUILD');
  useEffect(() => {
    if (!hasBuilding) return;
    const t = setInterval(() => apiService.getVMs().then(r => setVMs(r.servers || [])).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [hasBuilding]);

  const loadVMs = async () => {
    try { setLoading(true); setError(null); const r = await apiService.getVMs(); setVMs(r.servers || []); }
    catch { setError('Impossible de charger vos VMs'); }
    finally { setLoading(false); }
  };

  const doAction = async (vm, action) => {
    if (action === 'delete') { setDeleteId(vm.id); return; }
    setBusy(b => ({ ...b, [vm.id]: action }));
    try {
      await apiService.vmAction(vm.id, action);
      toast.success(action === 'start' ? 'Démarrage en cours…' : action === 'stop' ? 'Arrêt en cours…' : 'Redémarrage…');
      setTimeout(loadVMs, 1000);
    } catch (e) {
      const msg = e.response?.data?.error?.message;
      toast.error(e.response?.status === 409 ? (msg || 'Action impossible dans l\'état actuel') : (msg || 'Erreur'));
    } finally { setBusy(b => ({ ...b, [vm.id]: null })); }
  };

  const confirmDelete = async () => {
    const id = deleteId; if (!id) return;
    setBusy(b => ({ ...b, [id]: 'delete' }));
    try {
      await apiService.deleteVM(id); toast.success('VM supprimée');
      setDeleteId(null); setTimeout(loadVMs, 500);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Erreur'); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  };

  const getPrimaryIp = (vm) => {
    if (vm.preferredAddress) return vm.preferredAddress;
    const nets = vm?.addresses ? Object.values(vm.addresses) : [];
    if (nets.length && Array.isArray(nets[0]) && nets[0][0]) return nets[0][0].addr;
    return null;
  };

  const getIpv6 = (vm) => {
    const nets = vm?.addresses ? Object.values(vm.addresses) : [];
    if (nets.length && Array.isArray(nets[0])) {
      const v6 = nets[0].find(a => a.version === 6);
      if (v6) return v6.addr.slice(0, 20) + '…';
    }
    return 'fe80::3645…';
  };

  const totalPages = Math.max(1, Math.ceil(vms.length / PAGE_SIZE));
  const pageVMs    = vms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

  if (loading) return (
    <div className="cl-shell">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Skeleton variant="button" width={160} height={36} />
        <Skeleton variant="button" width={100} height={36} />
      </div>
      <div className="ds-grid">{[1,2,3,4].map(i => <Skeleton key={i} variant="card" height={240} style={{ borderRadius: 14 }} />)}</div>
    </div>
  );

  if (error) return (
    <div className="cl-shell">
      <div className="cl-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
        <button className="cl-btn cl-btn--primary" onClick={loadVMs}>Réessayer</button>
      </div>
    </div>
  );

  return (
    <div className="cl-shell">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
            Mes Machines Virtuelles
            <span style={{ marginLeft: '.5rem', background: '#f0f4ff', color: '#3b6ef6', fontSize: '.75rem', fontWeight: 700, padding: '.15rem .55rem', borderRadius: 20 }}>
              {vms.length}
            </span>
          </h2>
          <p style={{ margin: '.2rem 0 0', fontSize: '.8rem', color: '#64748b' }}>Gérez toutes vos VMs en un seul endroit</p>
        </div>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <Link to={`${basePath}/create`} className="cl-btn cl-btn--primary cl-btn--sm">
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 15, height: 15 }}>
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
            </svg>
            Créer une VM
          </Link>
          <button className="cl-btn cl-btn--ghost cl-btn--sm" onClick={loadVMs}>⟳ Actualiser</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ds-tabs">
        <button className={`ds-tab ${tab === 'purchased' ? 'ds-tab--active' : ''}`} onClick={() => setTab('purchased')}>
          Purchased Server
        </button>
        <button className={`ds-tab ${tab === 'orders' ? 'ds-tab--active' : ''}`} onClick={() => setTab('orders')}>
          My Orders
        </button>
      </div>

      {tab === 'orders' && (
        <div className="cl-card">
          <div className="cl-empty">
            <div className="cl-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <h3>Aucune commande en cours</h3>
            <p>Créez une nouvelle VM pour commencer.</p>
            <Link to={`${basePath}/create`} className="cl-btn cl-btn--primary">Créer une VM</Link>
          </div>
        </div>
      )}

      {tab === 'purchased' && vms.length === 0 && (
        <div className="cl-card">
          <div className="cl-empty">
            <div className="cl-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <h3>Aucune machine virtuelle</h3>
            <p>Lancez votre premier VPS en quelques clics. Facturation à la demi-heure.</p>
            <Link to={`${basePath}/create`} className="cl-btn cl-btn--primary">Créer ma première VM</Link>
          </div>
        </div>
      )}

      {tab === 'purchased' && vms.length > 0 && (
        <>
          <div className="ds-grid">
            {pageVMs.map((vm) => {
              const info = si(vm.status);
              const ip   = getPrimaryIp(vm);
              const ipv6 = getIpv6(vm);
              const vcpus  = vm.flavor?.vcpus || 4;
              const ramMb  = vm.flavor?.ram || 8;
              const disk   = vm.flavor?.disk || 120;
              const isBusy = !!busy[vm.id];
              const orderDate = fmtDate(vm.created || vm.createdAt);
              const paidDate  = vm.expiresAt ? fmtDate(vm.expiresAt) : 'Feb. 20 2025';

              return (
                <div key={vm.id} className="ds-server-card">
                  {/* Header */}
                  <div className="ds-card-header">
                    <div className="ds-card-title-row">
                      <div className="ds-company-flag" title="Sénégal" />
                      <div>
                        <Link to={`${basePath}/vms/${vm.id}`} style={{ textDecoration: 'none' }}>
                          <div className="ds-company-name" style={{ color: '#0f172a' }}>{vm.name || vm.id?.slice(0, 14)}</div>
                        </Link>
                        <div className="ds-vm-ref">Virtual / Vs-{vm.id?.slice(-3).toUpperCase() || '000'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
                      <div className="ds-paid-before">
                        Paid before
                        <span className="ds-paid-date">{paidDate}</span>
                      </div>
                      <span className={`ds-status-badge ${info.dsCls}`}>{info.label}</span>
                      <button className="ds-more-btn" title="Options">⋮</button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="ds-card-body">
                    <div className="ds-specs-row">
                      <div className="ds-spec-item">
                        <span className="ds-spec-label">Processor (CPU)</span>
                        <span className="ds-spec-value">lx3.3 GHz</span>
                      </div>
                      <div className="ds-spec-item">
                        <span className="ds-spec-label">Memory (RAM)</span>
                        <span className="ds-spec-value">{ramMb >= 1024 ? `${(ramMb/1024).toFixed(0)}MB` : `${ramMb}MB`}</span>
                      </div>
                      <div className="ds-spec-item">
                        <span className="ds-spec-label">SSD</span>
                        <span className="ds-spec-extra">{vcpus} GB</span>
                        <span className="ds-spec-extra">{disk}GB</span>
                      </div>
                    </div>

                    <div className="ds-detail-grid">
                      <div>
                        <div className="ds-section-title">Detail</div>
                        <div className="ds-detail-rows">
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">IPv4 address</span>
                            <span className="ds-detail-val">{ip || '—'}</span>
                          </div>
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">Services</span>
                            <span className="ds-detail-val">no</span>
                          </div>
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">Snapshot</span>
                            <span className="ds-detail-val">no</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="ds-section-title">Network Status</div>
                        <div className="ds-detail-rows">
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">IPv4 address</span>
                            <span className="ds-detail-val">{ip || '—'}</span>
                          </div>
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">IPv6 address</span>
                            <span className="ds-detail-val">{ipv6}</span>
                          </div>
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">Workload</span>
                            <span className="ds-detail-val">{vm.status === 'ACTIVE' ? '~10%' : '0%'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="ds-card-footer">
                    <div className="ds-order-info">
                      Order Date : <strong>{orderDate}</strong>
                    </div>
                    <div className="ds-card-actions">
                      <Link to={`${basePath}/vms/${vm.id}`} className="ds-action-icon" title="Voir détails">
                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                      </Link>
                      {vm.status === 'SHUTOFF' && (
                        <button className="ds-action-icon" style={{ color: '#22c55e' }} disabled={isBusy} onClick={() => doAction(vm, 'start')} title="Démarrer">
                          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
                        </button>
                      )}
                      {vm.status === 'ACTIVE' && (
                        <button className="ds-action-icon" style={{ color: '#f59e0b' }} disabled={isBusy} onClick={() => doAction(vm, 'stop')} title="Arrêter">
                          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
                        </button>
                      )}
                      {vm.status === 'ACTIVE' && (
                        <button className="ds-action-icon" disabled={isBusy} onClick={() => doAction(vm, 'reboot')} title="Redémarrer">
                          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
                        </button>
                      )}
                      <button className="ds-action-icon" style={{ color: '#ef4444' }} disabled={isBusy} onClick={() => doAction(vm, 'delete')} title="Supprimer">
                        <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {vms.length > PAGE_SIZE && (
            <div className="cl-pagination">
              <button className="cl-pgn-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} className={`cl-pgn-btn ${page === i+1 ? 'cl-pgn-btn--active' : ''}`} onClick={() => setPage(i+1)}>{i+1}</button>
              ))}
              <button className="cl-pgn-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </>
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Supprimer la VM"
        message="Êtes-vous sûr de vouloir supprimer cette VM ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </div>
  );
}
