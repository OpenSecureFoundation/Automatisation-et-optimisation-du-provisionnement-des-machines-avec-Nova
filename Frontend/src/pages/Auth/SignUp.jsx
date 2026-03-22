import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthVisual from '../../components/AuthVisual';
import '../../pages/Auth.css';

export default function SignUp() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [name, setName]             = useState('');
  const [isAdmin, setIsAdmin]       = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register }                = useAuth();
  const navigate                    = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const trimmedEmail    = email.trim();
      const trimmedPassword = password.trim();
      if (!trimmedEmail || !trimmedPassword) { setError('Email et mot de passe sont obligatoires.'); setSubmitting(false); return; }
      if (!/^(?=.*[0-9]).{8,}$/.test(trimmedPassword)) {
        setError('Le mot de passe doit contenir au moins 8 caractères et un chiffre.');
        setSubmitting(false); return;
      }
      const payload = {
        email,
        password,
        name: name || undefined,
        role: isAdmin ? 'admin' : 'client',
      };
      if (isAdmin && adminSecret) payload.adminSecret = adminSecret;

      const data = await register(payload);
      const role = data?.user?.role || 'client';
      navigate(role === 'admin' ? '/admin' : '/client', { replace: true });
    } catch (err) {
      const data    = err.response?.data;
      const errObj  = data?.error;
      const details = errObj?.details;
      const first   = Array.isArray(details) ? details[0] : null;
      const msg = errObj?.message
        || (first && (first.msg || first.message))
        || data?.message
        || (err.code === 'ERR_NETWORK' ? 'Connexion au serveur impossible.' : 'Inscription impossible');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split">
      <div className="auth-split-form">
        <Link to="/login" className="auth-logo" aria-label="VM Marketplace">
          <span className="auth-logo-icon" aria-hidden="true">VM</span>
          <span>VM Marketplace</span>
        </Link>
        <h1>Créer un compte</h1>
        <p className="auth-subtitle">Inscrivez-vous pour accéder à la plateforme.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-alert" role="alert">{error}</div>}

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">Email *</label>
            <div className="auth-input-wrap without-toggle">
              <input id="reg-email" type="email" className="auth-input" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="Adresse email"
                autoComplete="email" required />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-name">Nom (optionnel)</label>
            <div className="auth-input-wrap without-toggle">
              <input id="reg-name" type="text" className="auth-input" value={name}
                onChange={e => setName(e.target.value)} placeholder="Votre nom" autoComplete="name" />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-password">Mot de passe * (min. 8 caractères + 1 chiffre)</label>
            <div className="auth-input-wrap">
              <input id="reg-password" type={showPassword ? 'text' : 'password'} className="auth-input"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe"
                autoComplete="new-password" minLength={8} required />
              <button type="button" className="auth-toggle-password"
                onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-checkbox-label">
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
              <span>Créer un compte <strong>administrateur</strong></span>
            </label>
            <p className="auth-field-hint">Accès à la gestion des VMs, utilisateurs et facturation.</p>
          </div>

          {isAdmin && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-admin-secret">Clé secrète admin *</label>
              <div className="auth-input-wrap without-toggle">
                <input id="reg-admin-secret" type="password" className="auth-input"
                  value={adminSecret} onChange={e => setAdminSecret(e.target.value)}
                  placeholder="Clé fournie par l'administrateur principal" required={isAdmin} />
              </div>
              <p className="auth-field-hint" style={{ color: '#d97706' }}>
                ⚠ Une clé secrète est requise pour créer un compte admin en production.
              </p>
            </div>
          )}

          <button type="submit" className="auth-btn-submit" disabled={submitting}>
            {submitting ? 'Inscription...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="auth-footer-text">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
      </div>
      <div className="auth-split-visual">
        <AuthVisual />
      </div>
    </div>
  );
}
