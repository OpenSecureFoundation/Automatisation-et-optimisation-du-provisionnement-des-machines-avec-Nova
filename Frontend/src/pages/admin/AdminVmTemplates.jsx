import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import toast from 'react-hot-toast';
import { ConfirmModal } from '../../components';

export default function AdminVmTemplates() {
  const [templates, setTemplates] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', flavorId: '', imageId: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [tRes, fRes, iRes] = await Promise.all([
        apiService.getAdminVmTemplates(),
        apiService.getFlavors(),
        apiService.getImages()
      ]);
      setTemplates(tRes.templates || []);
      setFlavors(fRes.flavors || []);
      setImages(iRes.images || []);
    } catch (err) {
      toast.error('Impossible de charger les modèles.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.flavorId || !form.imageId) {
      toast.error('Nom, flavor et image requis.');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await apiService.updateAdminVmTemplate(editingId, form);
        toast.success('Modèle mis à jour.');
      } else {
        await apiService.createAdminVmTemplate(form);
        toast.success('Modèle créé.');
      }
      setEditingId(null);
      setForm({ name: '', description: '', flavorId: '', imageId: '' });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Erreur.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    setForm({ name: t.name, description: t.description || '', flavorId: t.flavorId, imageId: t.imageId });
  };

  const handleDeleteClick = (id) => setConfirmDeleteId(id);

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    if (!id) return;
    try {
      await apiService.deleteAdminVmTemplate(id);
      toast.success('Modèle supprimé.');
      setConfirmDeleteId(null);
      await load();
      if (editingId === id) setEditingId(null);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Erreur.');
      setConfirmDeleteId(null);
    }
  };

  if (loading) return <div className="card"><p>Chargement…</p></div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">Modèles VM</h2>
        <p className="card-subtitle">Les clients peuvent créer une VM à partir d’un modèle préconfiguré.</p>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>{editingId ? 'Modifier' : 'Nouveau modèle'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nom *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="form-control" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="form-control" />
            </div>
            <div className="form-group">
              <label className="form-label">Flavor *</label>
              <select value={form.flavorId} onChange={(e) => setForm((p) => ({ ...p, flavorId: e.target.value }))} className="form-control" required>
                <option value="">-- Choisir --</option>
                {flavors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Image *</label>
              <select value={form.imageId} onChange={(e) => setForm((p) => ({ ...p, imageId: e.target.value }))} className="form-control" required>
                <option value="">-- Choisir --</option>
                {images.map((img) => <option key={img.id} value={img.id}>{img.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : (editingId ? 'Mettre à jour' : 'Créer')}</button>
              {editingId && <button type="button" className="btn btn-secondary" onClick={() => { setEditingId(null); setForm({ name: '', description: '', flavorId: '', imageId: '' }); }}>Annuler</button>}
            </div>
          </form>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Liste</h3>
          {templates.length === 0 ? <p style={{ color: '#6b7280' }}>Aucun modèle.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {templates.map((t) => (
                <li key={t.id} style={{ padding: '0.75rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><strong>{t.name}</strong>{t.description && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}> – {t.description}</span>}</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleEdit(t)}>Modifier</button>
                    <button type="button" className="btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', background: '#fef2f2', color: '#b91c1c' }} onClick={() => handleDeleteClick(t.id)}>Suppr.</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer le modèle"
        message="Supprimer ce modèle ?"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />
    </div>
  );
}
