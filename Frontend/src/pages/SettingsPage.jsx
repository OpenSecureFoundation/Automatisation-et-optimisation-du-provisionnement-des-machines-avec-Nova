import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import './SettingsPage.css';

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/\d/.test(newPassword)) {
      setError('Le nouveau mot de passe doit contenir au moins un chiffre.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await apiService.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Impossible de modifier le mot de passe.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="settings-password-form" onSubmit={handleSubmit}>
      {error && <p className="settings-error">{error}</p>}
      {success && <p className="settings-success">Mot de passe modifié avec succès.</p>}
      <div className="settings-form-group">
        <label htmlFor="current-password">Mot de passe actuel</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </div>
      <div className="settings-form-group">
        <label htmlFor="new-password">Nouveau mot de passe</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={loading}
        />
        <span className="settings-hint">Au moins 8 caractères, dont un chiffre.</span>
      </div>
      <div className="settings-form-group">
        <label htmlFor="confirm-password">Confirmer le nouveau mot de passe</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          disabled={loading}
        />
      </div>
      <button type="submit" className="settings-btn-primary" disabled={loading}>
        {loading ? 'Modification...' : 'Changer le mot de passe'}
      </button>
    </form>
  );
}

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'security', label: 'Sécurité' },
];

export default function SettingsPage() {
  const { user: contextUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    apiService
      .getMe()
      .then((res) => {
        if (!cancelled && res.user) setProfile(res.user);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le profil.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const user = profile || contextUser;

  if (loading) {
    return (
      <div className="settings-page settings-profile-layout">
        <div className="settings-loading">
          <div className="settings-spinner" />
          <p>Chargement du profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page settings-profile-layout">
      {/* Carte profil type image 2 : avatar, nom, rôle */}
      <div className="settings-profile-card">
        <div className="settings-profile-avatar">
          {user?.name?.[0] || user?.email?.[0] || '?'}
        </div>
        <h1 className="settings-profile-name">{user?.name || user?.email || 'Utilisateur'}</h1>
        <p className="settings-profile-role">
          {user?.role === 'admin' ? 'Administrateur' : 'Client'} · VM Marketplace
        </p>
      </div>

      {/* Onglets */}
      <nav className="settings-tabs" aria-label="Sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Contenu Vue d'ensemble */}
      {activeTab === 'overview' && (
        <>
          <div className="settings-section-card">
            <h3 className="settings-section-title">Mon profil</h3>
            {error ? (
              <p className="settings-error">{error}</p>
            ) : (
              <dl className="settings-dl">
                <div className="settings-dl-row">
                  <dt>Email</dt>
                  <dd>{user?.email || '—'}</dd>
                </div>
                <div className="settings-dl-row">
                  <dt>Nom</dt>
                  <dd>{user?.name || 'Non renseigné'}</dd>
                </div>
                <div className="settings-dl-row">
                  <dt>Rôle</dt>
                  <dd>{user?.role === 'admin' ? 'Administrateur' : 'Client'}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="settings-section-card">
            <h3 className="settings-section-title">Compétences du compte</h3>
            <div className="settings-tags">
              <span className="settings-tag">VPS</span>
              <span className="settings-tag">Machines virtuelles</span>
              <span className="settings-tag">{user?.role === 'admin' ? 'Administration' : 'Gestion de VMs'}</span>
            </div>
          </div>
        </>
      )}

      {/* Contenu Sécurité */}
      {activeTab === 'security' && (
        <div className="settings-section-card">
          <h3 className="settings-section-title">Sécurité</h3>
          <p className="settings-section-desc">Modifiez votre mot de passe pour sécuriser votre compte.</p>
          <ChangePasswordForm />
        </div>
      )}
    </div>
  );
}
