import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, CardBody } from '../components/ui';
import apiService from '../services/api';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const VM_MODE_TEMPLATE = 'template';
const VM_MODE_CUSTOM = 'custom';

const DEFAULT_CPU_XAF_PER_H = 200;
const DEFAULT_RAM_XAF_PER_GB_H = 50;
const DEFAULT_DISK_XAF_PER_GB_H = 0.01;

function estimateHourlyXAF(vcpus, ramGb, diskGb) {
  return (vcpus || 0) * DEFAULT_CPU_XAF_PER_H + (ramGb || 0) * DEFAULT_RAM_XAF_PER_GB_H + (diskGb || 0) * DEFAULT_DISK_XAF_PER_GB_H;
}

function CreateVM() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedFlavorFromMarketplace = location.state?.selectedFlavor;
  const isClient = location.pathname.startsWith('/client');
  const isAdmin = location.pathname.startsWith('/admin');
  const [mode, setMode] = useState(VM_MODE_TEMPLATE);
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    flavorRef: selectedFlavorFromMarketplace?.id || '',
    imageRef: '',
    networkId: '',
    vcpus: 2,
    ramGb: 2,
    diskGb: 20,
    thresholdHigh: 80,
    thresholdLow: 20,
    scalingEnabled: true
  });

  const [templates, setTemplates] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [images, setImages] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [templatesResult, flavorsResult, imagesResult, networksResult] = await Promise.all([
        apiService.getVmTemplates().catch(() => ({ templates: [] })),
        apiService.getFlavors(),
        apiService.getImages(),
        apiService.getNetworks()
      ]);

      setTemplates(templatesResult.templates || []);
      setFlavors(flavorsResult.flavors || []);
      setImages(imagesResult.images || []);
      setNetworks(networksResult.networks || []);

      const privateNetwork = networksResult.networks?.find(n => n.name === 'private' || !n['router:external']);
      if (privateNetwork && !formData.networkId) {
        setFormData(prev => ({ ...prev, networkId: privateNetwork.id }));
      }
    } catch (err) {
      console.error('Error loading resources:', err);
      setError('Impossible de charger les ressources');
    } finally {
      setLoading(false);
    }
  }, [formData.networkId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  /* Quand on arrive depuis le marketplace avec un flavor choisi, préremplir le formulaire "Sur mesure" */
  useEffect(() => {
    if (!selectedFlavorFromMarketplace) return;
    const f = selectedFlavorFromMarketplace;
    setFormData(prev => ({
      ...prev,
      flavorRef: f.id || prev.flavorRef,
      vcpus: f.vcpus != null ? Number(f.vcpus) : prev.vcpus,
      ramGb: f.ram != null ? Math.round(Number(f.ram) / 1024) || prev.ramGb : prev.ramGb,
      diskGb: f.disk != null ? Number(f.disk) : prev.diskGb,
    }));
    setMode(VM_MODE_CUSTOM);
  }, [selectedFlavorFromMarketplace]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Le nom de la VM est requis');
      return;
    }
    if (mode === VM_MODE_TEMPLATE && !formData.templateId) {
      toast.error('Choisissez un modèle préconfiguré');
      return;
    }
    if (mode === VM_MODE_CUSTOM && !formData.imageRef) {
      toast.error('Choisissez une image pour la VM sur mesure');
      return;
    }
    if (mode !== VM_MODE_TEMPLATE && mode !== VM_MODE_CUSTOM) {
      if (!formData.flavorRef || !formData.imageRef) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }
    }

    const payload = {
      name: formData.name,
      networkId: formData.networkId || undefined
    };
    if (mode === VM_MODE_TEMPLATE) {
      payload.templateId = formData.templateId;
    } else if (mode === VM_MODE_CUSTOM) {
      payload.vcpus = Number(formData.vcpus) || 1;
      payload.ramGb = Number(formData.ramGb) || 1;
      payload.diskGb = Number(formData.diskGb) || 20;
      payload.imageRef = formData.imageRef;
    } else {
      payload.flavorRef = formData.flavorRef;
      payload.imageRef = formData.imageRef;
    }
    if (formData.scalingEnabled) {
      payload.scaling = {
        thresholdHigh: Number(formData.thresholdHigh) || 80,
        thresholdLow: Number(formData.thresholdLow) || 20,
        metricType: 'cpu_and_memory'
      };
    }

    try {
      setCreating(true);
      setError(null);
      await apiService.createVM(payload);
      toast.success('VM créée avec succès. Elle sera prête dans quelques minutes.');
      if (isClient) navigate('/client/vms');
      else if (isAdmin) navigate('/admin/vms');
      else navigate('/client/vms');
    } catch (err) {
      console.error('Error creating VM:', err);
      const msg = err.response?.data?.error?.message || 'Erreur lors de la création de la VM';
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === formData.templateId);
  };

  const getSelectedFlavor = () => {
    return flavors.find(f => f.id === formData.flavorRef);
  };

  const getSelectedImage = () => {
    return images.find(i => i.id === formData.imageRef);
  };

  const estimatedHourly = (() => {
    if (mode === VM_MODE_TEMPLATE && formData.templateId) {
      const t = getSelectedTemplate();
      if (!t?.flavorId) return null;
      const f = flavors.find(fl => fl.id === t.flavorId);
      if (!f) return null;
      const vcpus = f.vcpus || 1;
      const ramGb = (f.ram || 512) / 1024;
      const diskGb = f.disk || 20;
      return Math.round(estimateHourlyXAF(vcpus, ramGb, diskGb));
    }
    if (mode === VM_MODE_CUSTOM) {
      return Math.round(estimateHourlyXAF(formData.vcpus, formData.ramGb, formData.diskGb));
    }
    if (formData.flavorRef && mode !== VM_MODE_TEMPLATE) {
      const f = getSelectedFlavor();
      if (!f) return null;
      const vcpus = f.vcpus || 1;
      const ramGb = (f.ram || 512) / 1024;
      const diskGb = f.disk || 20;
      return Math.round(estimateHourlyXAF(vcpus, ramGb, diskGb));
    }
    return null;
  })();

  if (loading) {
    return (
      <div className="ds-loading-wrap">
        <LoadingSpinner message="Chargement du formulaire..." />
      </div>
    );
  }

  return (
    <div>
      <Card shadow="none" style={{ marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
        <CardBody className="card-header">
          <h1 className="card-title">Créer une Machine Virtuelle</h1>
          <p className="card-subtitle">Configurez et déployez votre nouvelle VM</p>
        </CardBody>
      </Card>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Formulaire */}
        <Card shadow="none" className="card" style={{ border: '1px solid #e2e8f0' }}>
          <CardBody>
          <h2 style={{ marginBottom: '1.5rem' }}>Configuration</h2>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <strong>Erreur:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Type de VM</label>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === VM_MODE_TEMPLATE}
                    onChange={() => setMode(VM_MODE_TEMPLATE)}
                  />
                  Préconfigurée (modèle)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === VM_MODE_CUSTOM}
                    onChange={() => setMode(VM_MODE_CUSTOM)}
                  />
                  Sur mesure (vCPU / RAM / disque)
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                📝 Nom de la VM <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
                placeholder="ex: mon-serveur-web"
                required
              />
            </div>

            {mode === VM_MODE_TEMPLATE && (
              <div className="form-group">
                <label className="form-label">
                  Modèle préconfiguré <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  name="templateId"
                  value={formData.templateId}
                  onChange={handleChange}
                  className="form-control"
                  required={mode === VM_MODE_TEMPLATE}
                >
                  <option value="">-- Choisir un modèle --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.description ? `– ${t.description}` : ''}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <small style={{ color: '#6b7280' }}>Aucun modèle. Utilisez « Sur mesure » ou demandez à l’admin d’en créer.</small>
                )}
              </div>
            )}

            {mode === VM_MODE_CUSTOM && (
              <>
                <div className="form-group">
                  <label className="form-label">vCPUs</label>
                  <input
                    type="number"
                    name="vcpus"
                    min={1}
                    value={formData.vcpus}
                    onChange={handleChange}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">RAM (Go)</label>
                  <input
                    type="number"
                    name="ramGb"
                    min={1}
                    value={formData.ramGb}
                    onChange={handleChange}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Disque (Go)</label>
                  <input
                    type="number"
                    name="diskGb"
                    min={1}
                    value={formData.diskGb}
                    onChange={handleChange}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Image <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    name="imageRef"
                    value={formData.imageRef}
                    onChange={handleChange}
                    className="form-control"
                    required={mode === VM_MODE_CUSTOM}
                  >
                    <option value="">-- Choisir une image --</option>
                    {images.map(image => (
                      <option key={image.id} value={image.id}>
                        {image.name} {image.size ? `(${(image.size / 1024 / 1024).toFixed(0)} MB)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Réseau</label>
              <select name="networkId" value={formData.networkId} onChange={handleChange} className="form-control">
                <option value="">-- Auto --</option>
                {networks.map(network => (
                  <option key={network.id} value={network.id}>
                    {network.name} {network['router:external'] ? '(Public)' : '(Privé)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="card" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Mise à l’échelle (scaling)</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={formData.scalingEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, scalingEnabled: e.target.checked }))}
                />
                Activer le scaling automatique (CPU et mémoire)
              </label>
              {formData.scalingEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Scale up si utilisation &gt; (%)</label>
                    <input
                      type="number"
                      name="thresholdHigh"
                      min={1}
                      max={100}
                      value={formData.thresholdHigh}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Scale down si utilisation &lt; (%)</label>
                    <input
                      type="number"
                      name="thresholdLow"
                      min={0}
                      max={100}
                      value={formData.thresholdLow}
                      onChange={handleChange}
                      className="form-control"
                    />
                  </div>
                </div>
              )}
            </div>

            {estimatedHourly != null && (
              <div className="create-vm-estimate" style={{ marginTop: '1.25rem', padding: '0.75rem 1rem', background: 'var(--primary-light, #f5f3ff)', borderRadius: '8px', fontSize: '0.95rem' }}>
                <strong>Coût estimé :</strong> ~{estimatedHourly.toLocaleString('fr-FR')} XAF/heure
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', marginTop: '0.25rem' }}>
                  Facturation par tranche de 30 min à l&apos;usage.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
              <Button type="submit" disabled={creating} color="primary" variant="flat" style={{ flex: '1 1 240px' }}>
                {creating ? 'Création en cours...' : 'Créer la VM'}
              </Button>
              <Button type="button" variant="light" style={{ flex: '1 1 160px' }} onClick={() => { if (isClient) navigate('/client/vms'); else if (isAdmin) navigate('/admin/vms'); else navigate('/client/vms'); }}>
                Annuler
              </Button>
            </div>
          </form>
          </CardBody>
        </Card>

        {/* Récapitulatif */}
        <Card shadow="none" className="card" style={{ border: '1px solid #e2e8f0' }}>
          <CardBody>
          <h2 style={{ marginBottom: '1.5rem' }}>Récapitulatif</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Nom</div>
              <div style={{ fontWeight: 'bold' }}>{formData.name || 'Non spécifié'}</div>
            </div>

            {mode === VM_MODE_TEMPLATE && getSelectedTemplate() && (
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Modèle</div>
              <div style={{ fontWeight: 'bold' }}>{getSelectedTemplate().name}</div>
              {getSelectedTemplate().description && (
                <div style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.25rem' }}>{getSelectedTemplate().description}</div>
              )}
            </div>
            )}

            {mode === VM_MODE_CUSTOM && (
              <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Sur mesure</div>
                <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                  <div>vCPUs: {formData.vcpus}</div>
                  <div>RAM: {formData.ramGb} Go</div>
                  <div>Disque: {formData.diskGb} Go</div>
                  <div>Image: {getSelectedImage()?.name || 'À choisir'}</div>
                </div>
              </div>
            )}

            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.75rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Scaling</div>
              <div style={{ fontWeight: 'bold' }}>
                {formData.scalingEnabled
                  ? `Scale up &gt; ${formData.thresholdHigh}% · Scale down &lt; ${formData.thresholdLow}%`
                  : 'Désactivé'}
              </div>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
            <strong>Info:</strong> Votre VM sera prête dans 2-5 minutes après la création.
          </div>
          </CardBody>
        </Card>
      </div>

      <Card shadow="none" className="card" style={{ marginTop: '2rem', background: '#fef3c7', border: '1px solid #e2e8f0' }}>
        <CardBody>
        <h3 style={{ marginBottom: '0.5rem' }}>⚠️ Important</h3>
        <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8', color: '#92400e', margin: 0 }}>
          <li>Assurez-vous d'avoir sélectionné la bonne image système</li>
          <li>La configuration peut être modifiée après la création (resize)</li>
          <li>Les VMs sont facturées à l'heure d'utilisation</li>
          <li>N'oubliez pas d'arrêter vos VMs quand vous ne les utilisez pas</li>
        </ul>
        </CardBody>
      </Card>
    </div>
  );
}

export default CreateVM;

