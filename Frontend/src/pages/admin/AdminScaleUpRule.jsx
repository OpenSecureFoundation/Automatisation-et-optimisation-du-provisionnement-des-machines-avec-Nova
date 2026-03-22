import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminScaleUpRule() {
  const [rule, setRule]     = useState({ deltaVcpus: 2, deltaRamMb: 4096, isActive: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiService.getAdminScaleUpRule();
      if (res.rule) setRule(prev => ({ ...prev, ...res.rule }));
    } catch { toast.error('Impossible de charger la règle.'); }
    finally { setLoading(false); }
  };

  const validate = () => {
    const errs = {};
    if (!Number.isInteger(Number(rule.deltaVcpus)) || Number(rule.deltaVcpus) < 1) {
      errs.deltaVcpus = 'Doit être un entier ≥ 1';
    }
    if (isNaN(Number(rule.deltaRamMb)) || Number(rule.deltaRamMb) < 512) {
      errs.deltaRamMb = 'Doit être ≥ 512 MB';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    try {
      setSaving(true);
      await apiService.putAdminScaleUpRule(rule);
      toast.success('Règle enregistrée.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Erreur.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="card"><p>Chargement…</p></div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">Règle de scale up globale</h2>
        <p className="card-subtitle">
          Lors d'un scale up automatique, ces ressources sont ajoutées au flavor actuel de chaque VM concernée.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 420 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">+ vCPUs à ajouter <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="number" min={1} step={1}
              value={rule.deltaVcpus}
              onChange={e => setRule(p => ({ ...p, deltaVcpus: Number(e.target.value) }))}
              className="form-control"
              style={errors.deltaVcpus ? { borderColor: '#ef4444' } : {}}
            />
            {errors.deltaVcpus && <small style={{ color: '#ef4444' }}>{errors.deltaVcpus}</small>}
            <small style={{ color: '#64748b' }}>Minimum 1 vCPU</small>
          </div>

          <div className="form-group">
            <label className="form-label">+ RAM à ajouter (Mo) <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="number" min={512} step={512}
              value={rule.deltaRamMb}
              onChange={e => setRule(p => ({ ...p, deltaRamMb: Number(e.target.value) }))}
              className="form-control"
              style={errors.deltaRamMb ? { borderColor: '#ef4444' } : {}}
            />
            {errors.deltaRamMb && <small style={{ color: '#ef4444' }}>{errors.deltaRamMb}</small>}
            <small style={{ color: '#64748b' }}>Minimum 512 MB. Ex: 4096 = 4 GB</small>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={rule.isActive}
                onChange={e => setRule(p => ({ ...p, isActive: e.target.checked }))} />
              Règle active (scale up autorisé)
            </label>
            <small style={{ color: '#64748b' }}>Si désactivée, aucun scale up automatique ne sera déclenché.</small>
          </div>

          <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 8, marginBottom: '1rem', fontSize: '0.82rem', color: '#475569' }}>
            <strong>Résumé :</strong> En cas de dépassement du seuil,{' '}
            la VM recevra <strong>+{rule.deltaVcpus} vCPU</strong> et{' '}
            <strong>+{(rule.deltaRamMb / 1024).toFixed(1)} GB RAM</strong> supplémentaires.
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer la règle'}
          </button>
        </form>
      </div>
    </div>
  );
}
