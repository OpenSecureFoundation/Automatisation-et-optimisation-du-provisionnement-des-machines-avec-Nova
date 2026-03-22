import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiService from '../../services/api';
import Skeleton from '../../components/Skeleton';
import './DataraServer.css';

const PAGE_SIZE = 6;

export default function AdminVMs() {
  const [vms, setVms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionVmId, setActionVmId] = useState(null);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('purchased');

  useEffect(() => { loadVms(); }, []);

  const loadVms = async () => {
    try {
      setLoading(true);
      const res = await apiService.getAdminVms();
      setVms(res.servers || []);
    } catch (err) {
      console.error('Load admin VMs:', err);
      toast.error('Impossible de charger la liste des VMs.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      ACTIVE: { label: 'Active', cls: 'ds-badge--active' },
      SHUTOFF: { label: 'Not Available', cls: 'ds-badge--unavailable' },
      BUILD: { label: 'Building', cls: 'ds-badge--building' },
      ERROR: { label: 'Error', cls: 'ds-badge--unavailable' },
      PAUSED: { label: 'Paused', cls: 'ds-badge--paused' },
      SUSPENDED: { label: 'Suspended', cls: 'ds-badge--paused' },
    };
    return map[status] || { label: status, cls: 'ds-badge--paused' };
  };

  const getPrimaryIp = (vm) => {
    if (vm.preferredAddress) return vm.preferredAddress;
    const nets = vm?.addresses ? Object.values(vm.addresses) : [];
    if (nets.length && Array.isArray(nets[0]) && nets[0][0]) return nets[0][0].addr;
    return '—';
  };

  const getIpv6 = (vm) => {
    const nets = vm?.addresses ? Object.values(vm.addresses) : [];
    if (nets.length && Array.isArray(nets[0])) {
      const v6 = nets[0].find(a => a.version === 6);
      if (v6) return v6.addr.slice(0, 18) + '…';
    }
    return 'fe80::3645…';
  };

  const handleAction = async (vm, action) => {
    const id = vm.dbId || vm.id;
    setActionVmId(id);
    try {
      await apiService.adminVmAction(id, action);
      toast.success(action === 'stop' ? 'VM arrêtée.' : 'VM démarrée.');
      loadVms();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Erreur');
    } finally {
      setActionVmId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(vms.length / PAGE_SIZE));
  const pageVms = vms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (d) => {
    if (!d) return 'Feb. 20 2025';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="ds-shell">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <Skeleton variant="button" width={140} height={36} />
          <Skeleton variant="button" width={100} height={36} />
        </div>
        <div className="ds-grid">
          {[1,2,3,4].map(i => <Skeleton key={i} variant="card" height={240} style={{ borderRadius: 14 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="ds-shell">
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
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Aucune commande en cours.
        </div>
      )}

      {tab === 'purchased' && (
        <>
          <div className="ds-grid">
            {pageVms.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                Aucune VM disponible. <Link to="/admin/create" style={{ color: '#3b6ef6' }}>Créer une VM</Link>
              </div>
            )}
            {pageVms.map(vm => {
              const si = getStatusBadge(vm.status);
              const ip = getPrimaryIp(vm);
              const ipv6 = getIpv6(vm);
              const vcpus = vm.flavor?.vcpus || 4;
              const ramMb = vm.flavor?.ram || 8192;
              const disk = vm.flavor?.disk || 120;
              const isBusy = actionVmId === (vm.dbId || vm.id);
              const orderDate = formatDate(vm.created || vm.createdAt);
              const paidDate = vm.expiresAt ? formatDate(vm.expiresAt) : 'Feb. 20 2025';
              const amount = vm.flavor?.price ? `$ ${(vm.flavor.price / 655).toFixed(2)}` : '$ 280.00';

              return (
                <div key={vm.id} className="ds-server-card">
                  {/* Header */}
                  <div className="ds-card-header">
                    <div className="ds-card-title-row">
                      <div className="ds-company-flag" title="France" />
                      <div>
                        <div className="ds-company-name">companyreal</div>
                        <div className="ds-vm-ref">Virtual / Vs-393</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <div className="ds-paid-before">
                        Paid before
                        <span className="ds-paid-date">{paidDate}</span>
                      </div>
                      <span className={`ds-status-badge ${si.cls}`}>{si.label}</span>
                      <button className="ds-more-btn" title="Options">⋮</button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="ds-card-body">
                    {/* Specs */}
                    <div className="ds-specs-row">
                      <div className="ds-spec-item">
                        <span className="ds-spec-label">Processor (CPU)</span>
                        <span className="ds-spec-value">lx3.3 GHz</span>
                      </div>
                      <div className="ds-spec-item">
                        <span className="ds-spec-label">Memory (RAM)</span>
                        <span className="ds-spec-value">{ramMb >= 1024 ? (ramMb/1024).toFixed(0) : ramMb}MB</span>
                      </div>
                      <div className="ds-spec-item">
                        <span className="ds-spec-label">SSD</span>
                        <span className="ds-spec-extra">{vcpus} GB</span>
                        <span className="ds-spec-extra">{disk}GB</span>
                      </div>
                    </div>

                    {/* Detail + Network Status */}
                    <div className="ds-detail-grid">
                      <div>
                        <div className="ds-section-title">Detail</div>
                        <div className="ds-detail-rows">
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">IPv4 address</span>
                            <span className="ds-detail-val">{ip !== '—' ? ip : '176.107.58.192'}</span>
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
                            <span className="ds-detail-val">105.209.11.192</span>
                          </div>
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">IPv6 address</span>
                            <span className="ds-detail-val">{ipv6}</span>
                          </div>
                          <div className="ds-detail-row">
                            <span className="ds-detail-key">Workload</span>
                            <span className="ds-detail-val">20%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="ds-card-footer">
                    <div className="ds-order-info">
                      Order Date : <strong>{orderDate}</strong> &nbsp; Amont : <strong>{amount}</strong>
                    </div>
                    <div className="ds-card-actions">
                      <Link to={`/admin/vms/${vm.id}`} className="ds-action-icon" title="Voir détails">
                        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                      </Link>
                      <button
                        className="ds-renew-btn"
                        title="Renouveler"
                        onClick={() => toast('Renouvellement non implémenté')}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 13, height: 13 }}>
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                        </svg>
                        Renew
                      </button>
                      {vm.status === 'ACTIVE' && (
                        <button
                          className="ds-action-icon"
                          title="Arrêter"
                          disabled={isBusy}
                          onClick={() => handleAction(vm, 'stop')}
                          style={{ color: '#ef4444' }}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clipRule="evenodd"/></svg>
                        </button>
                      )}
                      {vm.status === 'SHUTOFF' && (
                        <button
                          className="ds-action-icon"
                          title="Démarrer"
                          disabled={isBusy}
                          onClick={() => handleAction(vm, 'start')}
                          style={{ color: '#22c55e' }}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {vms.length > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ‹ Précédent
              </button>
              <span style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', color: '#64748b' }}>
                Page {page} / {totalPages}
              </span>
              <button
                style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569' }}
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Suivant ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
