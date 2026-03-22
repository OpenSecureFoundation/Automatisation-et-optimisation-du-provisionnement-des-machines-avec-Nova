import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiService from '../services/api';
import toast from 'react-hot-toast';
import Skeleton from '../components/Skeleton';
import { ConfirmModal } from '../components';
import { UsageChart } from '../components/charts/UsageChart';
import '../pages/client/ClientOverview.css';

function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'absolute'; el.style.left = '-9999px';
  document.body.appendChild(el); el.select();
  try { document.execCommand('copy'); return Promise.resolve(true); }
  catch { return Promise.resolve(false); }
  finally { document.body.removeChild(el); }
}

const STATUS_MAP = {
  ACTIVE:    { label: 'Running',  badgeCls: 'cl-badge--running',  dotCls: 'cl-vm-dot--active'  },
  SHUTOFF:   { label: 'Stopped',  badgeCls: 'cl-badge--stopped',  dotCls: 'cl-vm-dot--stopped' },
  BUILD:     { label: 'Building', badgeCls: 'cl-badge--building', dotCls: 'cl-vm-dot--build'   },
  ERROR:     { label: 'Error',    badgeCls: 'cl-badge--error',    dotCls: 'cl-vm-dot--error'   },
  PAUSED:    { label: 'Paused',   badgeCls: 'cl-badge--paused',   dotCls: 'cl-vm-dot--stopped' },
  SUSPENDED: { label: 'Suspended',badgeCls: 'cl-badge--paused',   dotCls: 'cl-vm-dot--stopped' },
};

function si(s) { return STATUS_MAP[s] || { label: s || '—', badgeCls: 'cl-badge--stopped', dotCls: 'cl-vm-dot--stopped' }; }

export default function VMDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const isClient     = window.location.pathname.startsWith('/client');
  const isAdmin      = !isClient;
  const basePath     = isClient ? '/client' : '/admin';

  const [vm, setVm]                     = useState(null);
  const [policy, setPolicy]             = useState(null);
  const [metrics, setMetrics]           = useState(null);
  const [metricsSource, setMetricsSource] = useState(null);
  const [metricsUpdatedAt, setMetricsUpdatedAt] = useState(null);
  const [scalingHistory, setScalingHistory] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadVm = useCallback(async () => {
    try {
      setLoading(true);
      if (isAdmin) {
        const res = await apiService.getAdminVM(id).catch(() => ({ server: null }));
        setVm(res.server || null);
        setMetrics({}); setPolicy(null); setScalingHistory([]);
      } else {
        const [svr, pol, met, hist] = await Promise.all([
          apiService.getVM(id).catch(() => ({ server: null })),
          apiService.getVmScalingPolicy(id).catch(() => ({ policy: null })),
          apiService.getVmMetrics(id).catch(() => ({ metrics: {} })),
          apiService.getVmScalingHistory(id).catch(() => ({ history: [] })),
        ]);
        setVm(svr.server || null);
        setPolicy(pol.policy || null);
        setMetrics(met.metrics || {});
        setMetricsSource(met.source || null);
        setMetricsUpdatedAt(new Date().toISOString());
        setScalingHistory(hist.history || []);
      }
    } catch (e) {
      toast.error('Impossible de charger la VM');
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => { if (id) loadVm(); }, [id, loadVm]);

  // SSE live metrics
  useEffect(() => {
    if (!id || !vm || vm.status !== 'ACTIVE' || isAdmin) return;
    let source = null, interval = null, closed = false;

    const apply = (payload) => {
      if (!payload) return;
      if (payload.latest && !payload.metrics) {
        const arrays = {};
        for (const [k, v] of Object.entries(payload.latest || {})) arrays[k] = v ? [v] : [];
        setMetrics(arrays);
      } else {
        setMetrics(payload.metrics || payload.latest || {});
      }
      setMetricsSource(payload.source || null);
      setMetricsUpdatedAt(new Date().toISOString());
    };

    const poll = () => { interval = setInterval(() => { apiService.getVmMetrics(id).then(apply).catch(() => {}); }, 15000); };

    if (typeof EventSource === 'function') {
      try {
        source = new EventSource(apiService.getVmMetricsStreamUrl(id));
        source.addEventListener('metrics', e => { if (!closed) try { apply(JSON.parse(e.data || '{}')); } catch {} });
        source.onerror = () => { if (!closed) poll(); };
      } catch { poll(); }
    } else { poll(); }

    return () => {
      closed = true;
      if (interval) clearInterval(interval);
      if (source) source.close();
    };
  }, [id, vm, isAdmin]);

  // Polling while BUILD
  useEffect(() => {
    if (!vm || vm.status !== 'BUILD') return;
    const fetch = isAdmin ? () => apiService.getAdminVM(id) : () => apiService.getVM(id);
    const t = setInterval(() => fetch().then(r => { if (r.server) setVm(r.server); }).catch(() => {}), 6000);
    return () => clearInterval(t);
  }, [id, vm, isAdmin]);

  const handleAction = async (action) => {
    if (action === 'delete') { setConfirmDelete(true); return; }
    try {
      setActionLoading(true);
      if (isAdmin) await apiService.adminVmAction(id, action);
      else await apiService.vmAction(id, action);
      toast.success(action === 'reboot' ? 'Redémarrage…' : action === 'start' ? 'Démarrage…' : 'Arrêt…');
      setTimeout(loadVm, 2000);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Erreur'); }
    finally { setActionLoading(false); }
  };

  const handleConfirmDelete = async () => {
    try {
      setActionLoading(true);
      if (isAdmin) await apiService.deleteAdminVM(id);
      else await apiService.deleteVM(id);
      toast.success('VM supprimée');
      navigate(`${basePath}/vms`);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Erreur'); setActionLoading(false); }
  };

  const copy = (text, label) => copyToClipboard(text).then(ok => ok ? toast.success(`${label} copié`) : toast.error('Copie impossible'));

  const chartData = useMemo(() => {
    const m = metrics || {};
    const series = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 30).reverse();
    const cpu = series(m.cpu_util);
    const mem = series(m.memory_usage || m.mem_util);
    const byTime = {};
    cpu.forEach(p => {
      const ts = p.timestamp ? new Date(p.timestamp).toISOString() : null; if (!ts) return;
      const t = new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (!byTime[ts]) byTime[ts] = { name: t, timestamp: ts };
      byTime[ts].cpu_util = p.value;
    });
    mem.forEach(p => {
      const ts = p.timestamp ? new Date(p.timestamp).toISOString() : null; if (!ts) return;
      const t = new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (!byTime[ts]) byTime[ts] = { name: t, timestamp: ts };
      byTime[ts].memory_usage = p.value;
    });
    return Object.values(byTime).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [metrics]);

  if (loading && !vm) return (
    <div className="cl-detail-shell">
      <Skeleton variant="title" width="40%" />
      <div className="cl-detail-hero">{[1,2,3,4].map(i => <Skeleton key={i} variant="card" height={90} style={{ borderRadius: 14 }} />)}</div>
      <Skeleton variant="card" height={280} style={{ borderRadius: 16 }} />
    </div>
  );

  if (!vm) return (
    <div className="cl-detail-shell">
      <div className="cl-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#64748b', marginBottom: '1rem' }}>VM introuvable.</p>
        <Link to={`${basePath}/vms`} className="cl-btn cl-btn--ghost">← Retour</Link>
      </div>
    </div>
  );

  const info       = si(vm.status);
  const flavor     = vm.flavor || {};
  const displayIp  = vm.preferredAddress || vm.accessIPv4 || (vm.addresses && Object.values(vm.addresses)[0]?.[0]?.addr);
  const sshLine    = displayIp ? `ssh root@${displayIp}` : '';
  const osName     = vm.image?.name || '—';
  const ramGb      = flavor.ram != null ? (flavor.ram / 1024).toFixed(0) : '—';

  // Metrics
  const m            = metrics || {};
  const cpuPct       = (m.cpu_util    || [])[0]?.value;
  const memPct       = (m.memory_usage || m.mem_util || [])[0]?.value;
  const diskPct      = (m.disk_usage  || [])[0]?.value;
  const netIn        = (m.network_incoming_bytes || [])[0]?.value;
  const netOut       = (m.network_outgoing_bytes || [])[0]?.value;

  const fmtPct  = v => v != null ? `${Math.round(v)}%` : '—';
  const fmtBytes = v => {
    if (v == null || isNaN(v)) return '—';
    const n = Number(v);
    if (n >= 1e9) return `${(n/1e9).toFixed(2)} GB`;
    if (n >= 1e6) return `${(n/1e6).toFixed(2)} MB`;
    if (n >= 1e3) return `${(n/1e3).toFixed(2)} KB`;
    return `${n} B`;
  };

  const metricFillCls = (v) => {
    if (v == null) return 'cl-metric-fill--cpu';
    if (v >= 85) return 'cl-metric-fill--danger';
    return 'cl-metric-fill--cpu';
  };

  return (
    <div className="cl-detail-shell">
      {/* Breadcrumb */}
      <div className="cl-breadcrumb">
        <Link to={basePath}>Accueil</Link>
        <span className="cl-breadcrumb-sep">/</span>
        <Link to={`${basePath}/vms`}>{isAdmin ? 'VMs' : 'Mes VMs'}</Link>
        <span className="cl-breadcrumb-sep">/</span>
        <span>{vm.name || vm.id}</span>
      </div>

      {/* Hero info cards */}
      <div className="cl-detail-hero">
        {/* OS & Status */}
        <div className="cl-detail-card" style={{ animationDelay: '.05s' }}>
          <span className="cl-detail-card__label">Système d'exploitation</span>
          <span className="cl-detail-card__value" style={{ fontSize: '.95rem' }}>{osName}</span>
          <span className="cl-detail-card__sub">KVM {flavor.vcpus || '—'} vCPU</span>
          <span className={`cl-badge ${info.badgeCls}`} style={{ width: 'fit-content', marginTop: '.2rem' }}>{info.label}</span>
        </div>

        {/* SSH Access */}
        <div className="cl-detail-card" style={{ animationDelay: '.10s' }}>
          <span className="cl-detail-card__label">Accès SSH root</span>
          <span className="cl-detail-card__value" style={{ fontSize: '.82rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {sshLine || 'IP non disponible'}
          </span>
          {sshLine && (
            <button className="cl-copy-btn" style={{ marginTop: '.2rem', width: 'fit-content' }} onClick={() => copy(sshLine, 'Commande SSH')}>
              Copier SSH
            </button>
          )}
        </div>

        {/* Plan */}
        <div className="cl-detail-card" style={{ animationDelay: '.15s' }}>
          <span className="cl-detail-card__label">Plan actuel</span>
          <span className="cl-detail-card__value">{flavor.name || `KVM ${flavor.vcpus || '—'}`}</span>
          <span className="cl-detail-card__sub">{flavor.vcpus || '—'} vCPU · {ramGb} GB RAM · {flavor.disk || '—'} GB</span>
          <Link to={`${basePath}/create`} className="cl-card__link" style={{ marginTop: '.2rem' }}>Améliorer ↗</Link>
        </div>

        {/* Actions */}
        <div className="cl-detail-card" style={{ gap: '.5rem', animationDelay: '.20s' }}>
          <span className="cl-detail-card__label">Actions</span>
          {vm.status === 'ACTIVE' && (
            <button className="cl-btn cl-btn--primary cl-btn--sm" disabled={actionLoading} onClick={() => handleAction('reboot')}>
              <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
              Redémarrer
            </button>
          )}
          {vm.status === 'SHUTOFF' && (
            <button className="cl-btn cl-btn--primary cl-btn--sm" disabled={actionLoading} onClick={() => handleAction('start')}>Démarrer</button>
          )}
          {vm.status === 'ACTIVE' && (
            <button className="cl-btn cl-btn--ghost cl-btn--sm" disabled={actionLoading} onClick={() => handleAction('stop')}>Arrêter</button>
          )}
          <button className="cl-btn cl-btn--danger cl-btn--sm" disabled={actionLoading} onClick={() => handleAction('delete')}>Supprimer</button>
        </div>
      </div>

      {/* Metrics */}
      <div className="cl-card">
        <div className="cl-card__head">
          <h3 className="cl-card__title">Utilisation des ressources</h3>
          <div style={{ display: 'flex', gap: '.75rem', fontSize: '.78rem', color: '#94a3b8', alignItems: 'center' }}>
            {metricsSource?.primary && <span>Source: <strong style={{ color: '#64748b' }}>{metricsSource.primary}</strong></span>}
            {metricsUpdatedAt && <span>Màj: <strong style={{ color: '#64748b' }}>{new Date(metricsUpdatedAt).toLocaleTimeString('fr-FR')}</strong></span>}
          </div>
        </div>

        {cpuPct == null && memPct == null && diskPct == null && (
          <p style={{ padding: '0 1.25rem', fontSize: '.82rem', color: '#94a3b8', background: '#fafbff', margin: '0 1.25rem .75rem', borderRadius: 8, padding: '.6rem 1rem', border: '1px solid #edf0f7' }}>
            Les métriques apparaîtront ici dès que la collecte est active. Vérifiez que la VM est démarrée.
          </p>
        )}

        <div className="cl-metrics-grid">
          <MetricCard label="CPU" value={fmtPct(cpuPct)} pct={cpuPct} fillCls={metricFillCls(cpuPct)} />
          <MetricCard label="Mémoire" value={fmtPct(memPct)} pct={memPct} fillCls="cl-metric-fill--mem" />
          <MetricCard label="Disque" value={fmtPct(diskPct)} pct={diskPct} fillCls="cl-metric-fill--disk" />
          <MetricCard label="Trafic entrant" value={fmtBytes(netIn)} pct={null} noBar />
          <MetricCard label="Trafic sortant" value={fmtBytes(netOut)} pct={null} noBar />
          <MetricCard
            label="Bande passante"
            value={netIn != null && netOut != null ? fmtBytes(netIn + netOut) : '—'}
            pct={null} noBar
          />
        </div>

        {chartData.length > 1 && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <UsageChart
              data={chartData}
              dataKeys={[
                { key: 'cpu_util',    color: '#3b6ef6', name: 'CPU %' },
                { key: 'memory_usage', color: '#8b5cf6', name: 'Mémoire %' },
              ]}
              title="CPU & Mémoire dans le temps"
              height={200}
            />
          </div>
        )}
      </div>

      {/* Info table */}
      <div className="cl-card">
        <div className="cl-card__head">
          <h3 className="cl-card__title">Informations de la VM</h3>
        </div>
        <div className="cl-info-table">
          <InfoRow label="Nom" value={vm.name || vm.id} />
          <InfoRow label="OS" value={osName} />
          <InfoRow label="IPv4" value={displayIp || '—'} copyable onCopy={() => displayIp && copy(displayIp, 'IP')} />
          <InfoRow label="SSH" value={sshLine || '—'} copyable onCopy={() => sshLine && copy(sshLine, 'SSH')} mono />
          <InfoRow label="vCPU" value={`${flavor.vcpus || '—'} cœurs`} />
          <InfoRow label="RAM" value={`${ramGb} GB`} />
          <InfoRow label="Disque" value={`${flavor.disk || '—'} GB`} />
          <InfoRow label="Statut" value={<span className={`cl-badge ${info.badgeCls}`}>{info.label}</span>} />
          {isAdmin && vm.owner && (
            <InfoRow label="Propriétaire" value={vm.owner.name || vm.owner.email || vm.owner.id} />
          )}
        </div>

        {/* SSH Terminal box */}
        {sshLine && (
          <div style={{ padding: '0 1.25rem 1.25rem' }}>
            <div className="cl-ssh-box">
              <code className="cl-ssh-cmd">{sshLine}</code>
              <button className="cl-copy-btn" style={{ background: '#1e293b', color: '#7dd3fc', border: '1px solid #334155' }} onClick={() => copy(sshLine, 'SSH')}>
                Copier
              </button>
              {vm.status === 'ACTIVE' && (
                <button
                  className="cl-btn cl-btn--primary cl-btn--sm"
                  disabled={consoleLoading}
                  onClick={async () => {
                    setConsoleLoading(true);
                    try {
                      const dbId = vm.dbId;
                      let res;
                      if (isAdmin) res = await apiService.getAdminVmConsole(dbId || vm.id);
                      else if (dbId) {
                        try { res = await apiService.getVmConsoleByDbId(dbId); }
                        catch (e) { if (e.response?.status === 404) res = await apiService.getVmConsole(vm.id); else throw e; }
                      } else res = await apiService.getVmConsole(vm.id);
                      if (res?.url) window.open(res.url, '_blank', 'noopener,noreferrer');
                      else toast.error('Console non disponible');
                    } catch (e) {
                      toast.error(e.response?.data?.error?.message || 'Console indisponible');
                    } finally { setConsoleLoading(false); }
                  }}
                >
                  {consoleLoading ? 'Ouverture…' : 'Console VNC'}
                </button>
              )}
              {(vm.status === 'ACTIVE' || vm.status === 'SHUTOFF') && (
                <button
                  className="cl-btn cl-btn--ghost cl-btn--sm"
                  disabled={snapshotLoading}
                  onClick={async () => {
                    setSnapshotLoading(true);
                    try {
                      await apiService.createVmSnapshot(vm.id, `snap-${vm.name || 'vm'}-${Date.now()}`);
                      toast.success('Snapshot en cours de création.');
                    } catch (e) { toast.error(e.response?.data?.error?.message || 'Erreur snapshot'); }
                    finally { setSnapshotLoading(false); }
                  }}
                >
                  {snapshotLoading ? 'Création…' : 'Snapshot'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scaling policy */}
      {policy && (
        <div className="cl-card">
          <div className="cl-card__head">
            <h3 className="cl-card__title">Scaling automatique</h3>
            <span className={`cl-badge ${policy.isActive ? 'cl-badge--running' : 'cl-badge--stopped'}`}>
              {policy.isActive ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <div className="cl-info-table">
            <InfoRow label="Métrique"     value={policy.metricType || 'cpu_and_memory'} />
            <InfoRow label="Scale up si"  value={`≥ ${policy.thresholdHigh}%`} />
            <InfoRow label="Scale down si" value={`≤ ${policy.thresholdLow}%`} />
            <InfoRow label="Cooldown"     value={`${policy.cooldownMinutes} min`} />
          </div>
          {scalingHistory.length > 0 && (
            <>
              <div className="cl-card__head" style={{ paddingTop: '.75rem' }}>
                <h3 className="cl-card__title" style={{ fontSize: '.82rem', color: '#64748b' }}>Historique</h3>
              </div>
              <ul className="cl-history-list">
                {scalingHistory.slice(0, 8).map(e => (
                  <li key={e.id} className="cl-history-item">
                    <span className={`cl-history-dot ${e.action?.includes('up') ? 'cl-history-dot--up' : 'cl-history-dot--down'}`} />
                    <span style={{ fontWeight: 600 }}>{e.action?.includes('up') ? '↑ Scale UP' : '↓ Scale DOWN'}</span>
                    <span style={{ color: '#94a3b8', marginLeft: 'auto', fontSize: '.75rem' }}>
                      {new Date(e.timestamp).toLocaleString('fr-FR')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="cl-detail-footer">
        <Link to={`${basePath}/vms`} className="cl-btn cl-btn--ghost">← Retour aux VMs</Link>
        <button className="cl-btn cl-btn--danger" disabled={actionLoading} onClick={() => handleAction('delete')}>
          Supprimer la VM
        </button>
      </div>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
        title="Supprimer la VM"
        message="Cette action est irréversible. Supprimer la VM ?"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </div>
  );
}

function MetricCard({ label, value, pct, fillCls = 'cl-metric-fill--cpu', noBar = false }) {
  return (
    <div className="cl-metric-card">
      <span className="cl-metric-label">{label}</span>
      <span className="cl-metric-value">{value}</span>
      {!noBar && (
        <div className="cl-metric-bar">
          <div className={`cl-metric-fill ${fillCls}`} style={{ width: `${pct != null ? Math.min(100, Math.max(0, pct)) : 0}%` }} />
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, copyable, onCopy, mono }) {
  return (
    <div className="cl-info-row">
      <span className="cl-info-key">{label}</span>
      <span className="cl-info-val" style={mono ? { fontFamily: 'monospace', fontSize: '.78rem' } : {}}>
        {typeof value === 'string' && value.length > 40
          ? <span title={value}>{value.slice(0, 40)}…</span>
          : value}
        {copyable && onCopy && (
          <button className="cl-copy-btn" onClick={onCopy}>Copier</button>
        )}
      </span>
    </div>
  );
}
