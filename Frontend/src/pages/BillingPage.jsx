import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, CardBody, Chip, Input } from '../components/ui';
import apiService from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import Skeleton from '../components/Skeleton';
import './BillingPage.css';

export default function BillingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));
  
  const [invoices, setInvoices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsForm, setPrefsForm] = useState({
    paymentMode: 'manual',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: '',
    brand: 'TEST'
  });

  // Admin filters
  const [filters, setFilters] = useState({
    status: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    sort: 'generatedAt',
    order: 'DESC',
    page: 1,
    limit: 20
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiService.getBillingPreferences();
      if (res.preferences) {
        setPreferences(res.preferences);
        setPrefsForm((prev) => ({
          ...prev,
          paymentMode: res.preferences.paymentMode || 'manual'
        }));
      }
    } catch (err) {
      console.error('Load preferences:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    const fetchInvoice = isAdmin ? () => apiService.getAdminInvoice(selectedId) : () => apiService.getInvoice(selectedId);
    fetchInvoice()
      .then((res) => {
        if (!cancelled && res.invoice) setDetail(res.invoice);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => { cancelled = true; };
  }, [selectedId, isAdmin]);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let res;
      if (isAdmin) {
        res = await apiService.getAdminInvoices({
          status: filters.status || undefined,
          userId: filters.userId || undefined,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          sort: filters.sort,
          order: filters.order,
          page: filters.page,
          limit: filters.limit
        });
        setInvoices(res.invoices || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        res = await apiService.getInvoices();
        setInvoices(res.invoices || []);
      }
    } catch (err) {
      console.error('Billing load:', err);
      setError('Impossible de charger les factures.');
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin]);

  useEffect(() => {
    loadInvoices();
    if (!isAdmin) {
      loadPreferences();
    }
  }, [isAdmin, filters.page, filters.status, filters.sort, filters.order, filters.dateFrom, filters.dateTo, filters.userId, loadInvoices, loadPreferences]);

  const handleDownload = async (id) => {
    try {
      const res = isAdmin
        ? await apiService.downloadAdminInvoicePdf(id)
        : await apiService.downloadInvoicePdf(id);
      const blob = res.data;
      const contentType = (res.headers['content-type'] || '').toLowerCase();
      if (res.status !== 200 || !contentType.includes('pdf')) {
        const text = await blob.text();
        let msg = 'Réponse invalide du serveur.';
        try {
          const json = JSON.parse(text);
          msg = json.error?.message || msg;
        } catch (_) {
          if (text.length < 200) msg = text;
        }
        toast.error(msg);
        return;
      }
      let filename = res.headers['content-disposition']
        ? res.headers['content-disposition'].replace(/.*filename=/, '').trim().replace(/^["']|["']$/g, '') || `facture_${detail?.invoiceNumber || id}.pdf`
        : `facture_${detail?.invoiceNumber || id}.pdf`;
      if (!filename.toLowerCase().endsWith('.pdf')) filename = `${filename}.pdf`;
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Téléchargement démarré.');
    } catch (err) {
      let msg = 'Erreur lors du téléchargement.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.error?.message || msg;
        } catch (_) {}
      } else if (err.response?.data?.error?.message) {
        msg = err.response.data.error.message;
      }
      toast.error(msg);
    }
  };

  const handlePay = async (id) => {
    try {
      setPayingId(id);
      await apiService.payInvoice(id);
      toast.success('Facture marquée comme payée.');
      await loadInvoices();
      if (selectedId === id) {
        const fetchInvoice = isAdmin ? () => apiService.getAdminInvoice(id) : () => apiService.getInvoice(id);
        const res = await fetchInvoice();
        setDetail(res.invoice || null);
      }
    } catch (err) {
      console.error('Pay invoice:', err);
      toast.error(err.response?.data?.error?.message || 'Erreur lors du paiement.');
    } finally {
      setPayingId(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (amount, currency = 'XAF') => {
    if (amount == null) return '—';
    return `${Number(amount).toLocaleString('fr-FR')} ${currency}`;
  };

  const statusLabel = (status) => {
    const map = { pending: 'En attente', paid: 'Payée', overdue: 'En retard' };
    return map[status] || status;
  };

  const statusColor = (status) => {
    const map = { pending: 'warning', paid: 'success', overdue: 'danger' };
    return map[status] || 'default';
  };

  const handleSavePreferences = async () => {
    try {
      setPrefsSaving(true);
      await apiService.updateBillingPreferences({
        paymentMode: prefsForm.paymentMode,
        card: prefsForm.paymentMode === 'auto' ? {
          cardNumber: prefsForm.cardNumber,
          cardExpiry: prefsForm.cardExpiry,
          cardCvv: prefsForm.cardCvv,
          brand: prefsForm.brand || 'TEST'
        } : undefined
      });
      await loadPreferences();
      toast.success('Préférences enregistrées.');
    } catch (err) {
      console.error('Save preferences:', err);
      toast.error(err.response?.data?.error?.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setPrefsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-page">
        <div className="billing-header">
          <Skeleton variant="title" width="30%" />
          <div style={{ marginTop: '0.5rem' }}>
            <Skeleton variant="text" width="50%" />
          </div>
        </div>
        {isAdmin && (
          <section className="billing-card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <Skeleton variant="title" width="20%" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="card" height={60} />
              ))}
            </div>
          </section>
        )}
        <div className="billing-grid">
          <section className="billing-list-card billing-card">
            <div style={{ marginBottom: '1rem' }}>
              <Skeleton variant="title" width="40%" />
            </div>
            <Skeleton variant="line" count={5} />
          </section>
          <section className="billing-detail-card billing-card">
            <div style={{ marginBottom: '1rem' }}>
              <Skeleton variant="title" width="30%" />
            </div>
            <Skeleton variant="line" count={4} />
          </section>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="billing-page">
        <div className="billing-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-page">
      <div className="billing-header">
        <h2 className="billing-title">{isAdmin ? 'Facturation (Toutes les factures)' : 'Facturation'}</h2>
        <p className="billing-subtitle">{isAdmin ? 'Gérez toutes les factures de la plateforme.' : 'Consultez et téléchargez vos factures.'}</p>
      </div>

      {isAdmin && (
        <Card shadow="none" className="billing-card" style={{ marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <CardBody>
          <h3 className="billing-card-title">Filtres</h3>
          <div className="billing-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                className="billing-input"
              >
                <option value="">Tous</option>
                <option value="pending">En attente</option>
                <option value="paid">Payée</option>
                <option value="overdue">En retard</option>
                <option value="draft">Brouillon</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Tri par</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                className="billing-input"
              >
                <option value="generatedAt">Date</option>
                <option value="totalAmount">Montant</option>
                <option value="status">Statut</option>
                <option value="invoiceNumber">N° facture</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Ordre</label>
              <select
                value={filters.order}
                onChange={(e) => setFilters(prev => ({ ...prev, order: e.target.value }))}
                className="billing-input"
              >
                <option value="DESC">Décroissant</option>
                <option value="ASC">Croissant</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Date début</label>
              <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value, page: 1 }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>Date fin</label>
              <Input type="date" value={filters.dateTo} onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value, page: 1 }))} />
            </div>
            {(filters.status || filters.dateFrom || filters.dateTo) && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button type="button" variant="flat" onClick={() => setFilters({ status: '', userId: '', dateFrom: '', dateTo: '', sort: 'generatedAt', order: 'DESC', page: 1, limit: 20 })}>Réinitialiser</Button>
              </div>
            )}
          </div>
          </CardBody>
        </Card>
      )}

      {!isAdmin && (
        <Card shadow="none" className="billing-card" style={{ marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
          <CardBody>
          <h3 className="billing-card-title">Préférences de paiement</h3>
        <div className="billing-preferences">
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Mode de règlement</label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="paymentMode"
                  checked={prefsForm.paymentMode === 'manual'}
                  onChange={() => setPrefsForm((p) => ({ ...p, paymentMode: 'manual' }))}
                />
                Manuel (je paie chaque facture à la main)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="paymentMode"
                  checked={prefsForm.paymentMode === 'auto'}
                  onChange={() => setPrefsForm((p) => ({ ...p, paymentMode: 'auto' }))}
                />
                Automatique (débit quotidien)
              </label>
            </div>
          </div>
          {prefsForm.paymentMode === 'auto' && (
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 8, marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                Carte de paiement (fictive, environnement TEST)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', maxWidth: 560 }}>
                <Input type="text" placeholder="Numéro (ex: 4242424242424242)" value={prefsForm.cardNumber} onChange={(e) => setPrefsForm((p) => ({ ...p, cardNumber: e.target.value }))} maxLength={19} />
                <Input type="text" placeholder="MM/AA" value={prefsForm.cardExpiry} onChange={(e) => setPrefsForm((p) => ({ ...p, cardExpiry: e.target.value }))} maxLength={5} />
                <Input type="text" placeholder="CVV" value={prefsForm.cardCvv} onChange={(e) => setPrefsForm((p) => ({ ...p, cardCvv: e.target.value }))} maxLength={4} />
              </div>
              {preferences?.card?.hasCard && (
                <div style={{ fontSize: '0.875rem', color: '#059669', marginTop: '0.5rem' }}>
                  Carte enregistrée (•••• {preferences.card.last4}) {preferences.card.isTest && '(TEST)'}
                </div>
              )}
            </div>
          )}
          <Button type="button" color="primary" variant="flat" onClick={handleSavePreferences} disabled={prefsSaving}>
            {prefsSaving ? 'Enregistrement…' : 'Enregistrer les préférences'}
          </Button>
        </div>
          </CardBody>
        </Card>
      )}

      <div className="billing-grid">
        <section className="billing-list-card billing-card">
          <h3 className="billing-card-title">{isAdmin ? 'Toutes les factures' : 'Mes factures'}</h3>
          {invoices.filter((inv) => Number(inv.totalAmount || 0) > 0).length === 0 ? (
            <p className="billing-empty">Aucune facture pour le moment.</p>
          ) : (
            <>
            <ul className="billing-list">
              {invoices
                .filter((inv) => Number(inv.totalAmount || 0) > 0)
                .map((inv, idx) => (
                <li
                  key={inv.id}
                  className={`billing-list-item list-item ${selectedId === inv.id ? 'active' : ''}`}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                    <button
                      type="button"
                      className={`billing-list-item-btn ${isAdmin ? 'billing-list-item-btn-admin' : 'billing-list-item-btn-client'}`}
                      onClick={() => setSelectedId(inv.id)}
                    >
                      <span className="billing-list-item-num">{inv.invoiceNumber}</span>
                      {isAdmin && inv.user && (
                        <span className="billing-list-item-client" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {inv.user.name || inv.user.email}
                        </span>
                      )}
                      <span className="billing-list-item-date">{formatDate(inv.generatedAt)}</span>
                      <Chip size="sm" color={statusColor(inv.status)} variant="flat">
                        {statusLabel(inv.status)}
                      </Chip>
                      <span className="billing-list-item-amount">{formatAmount(inv.totalAmount, inv.currency)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {isAdmin && pagination.totalPages > 1 && (
                <div className="billing-pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <Button type="button" variant="flat" onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))} disabled={filters.page === 1}>
                    Précédent
                  </Button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    Page {pagination.page} sur {pagination.totalPages} ({pagination.total} factures)
                  </span>
                  <Button type="button" variant="flat" onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))} disabled={filters.page >= pagination.totalPages}>
                    Suivant
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="billing-detail-card billing-card">
          <h3 className="billing-card-title">Détail</h3>
          {!selectedId ? (
            <p className="billing-empty">Sélectionnez une facture.</p>
          ) : loadingDetail ? (
            <div className="billing-loading-inline">
              <div className="billing-spinner" />
            </div>
          ) : detail ? (
            <div className="billing-detail">
              <div className="billing-detail-row">
                <span className="billing-detail-label">N° facture</span>
                <span className="billing-detail-value">{detail.invoiceNumber}</span>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">Période</span>
                <span className="billing-detail-value">
                  {formatDate(detail.periodStart)} → {formatDate(detail.periodEnd)}
                </span>
              </div>
              <div className="billing-detail-row">
                <span className="billing-detail-label">Statut</span>
                <span className="billing-detail-value">
                  <Chip size="sm" color={statusColor(detail.status)} variant="flat">
                  {statusLabel(detail.status)}
                  </Chip>
                </span>
              </div>
              {isAdmin && detail.user && (
                <div className="billing-detail-row">
                  <span className="billing-detail-label">Client</span>
                  <span className="billing-detail-value">
                    {detail.user.name || detail.user.email} {detail.user.email && detail.user.name && `(${detail.user.email})`}
                  </span>
                </div>
              )}
              <div className="billing-detail-row">
                <span className="billing-detail-label">Total</span>
                <span className="billing-detail-value billing-detail-total">
                  {formatAmount(detail.totalAmount, detail.currency)}
                </span>
              </div>
              {detail.items && detail.items.length > 0 && (
                <div className="billing-detail-items">
                  <div className="billing-detail-label">Lignes</div>
                  <div className="billing-table-wrap">
                    <table className="billing-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Heures</th>
                          <th>Prix par heure</th>
                          <th>Prix total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.description}</td>
                            <td>{item.quantity}</td>
                            <td>{formatAmount(item.unitPrice, detail.currency)}</td>
                            <td>{formatAmount(item.total, detail.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="billing-detail-actions">
                <Button type="button" variant="flat" onClick={() => handleDownload(detail.id)}>
                  Télécharger PDF
                </Button>
                {(detail.status === 'pending' || detail.status === 'overdue') && (
                  <Button type="button" color="primary" variant="flat" onClick={() => handlePay(detail.id)} disabled={payingId === detail.id}>
                    {payingId === detail.id ? 'Paiement…' : 'Marquer payée'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p className="billing-empty">Facture introuvable.</p>
          )}
        </section>
      </div>
    </div>
  );
}
