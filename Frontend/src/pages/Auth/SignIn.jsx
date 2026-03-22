import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import AuthVisual from '../../components/AuthVisual';
import '../../pages/Auth.css';

const REMEMBER_KEY = 'vm-marketplace-remember-email';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch (_) {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      if (!trimmedEmail || !trimmedPassword) {
        setError('Email et mot de passe sont obligatoires.');
        return;
      }
      const strongEnough = trimmedPassword.length >= 8;
      if (!strongEnough) {
        setError('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
      const data = await login(email, password);
      if (rememberMe) {
        try { localStorage.setItem(REMEMBER_KEY, email); } catch (_) {}
      } else {
        try { localStorage.removeItem(REMEMBER_KEY); } catch (_) {}
      }
      const role = data?.user?.role || 'client';
      navigate(role === 'admin' ? '/admin' : '/client', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        (err.response?.status === 0 || err.code === 'ERR_NETWORK' ? 'Connexion au serveur impossible.' : 'Identifiants incorrects.');
      console.error('[SignIn] submit error', { message: msg, status: err?.response?.status, code: err?.code, url: err?.config?.baseURL + err?.config?.url });
      setError(msg);
      toast.error(msg);
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
        <p className="auth-tagline">VPS à la demande, facturés à l&apos;usage</p>
        <h1>Connexion</h1>
        <p className="auth-subtitle">
          Connectez-vous pour accéder à votre espace client ou administrateur.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-alert" role="alert">
              {error}
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email *</label>
            <div className="auth-input-wrap without-toggle">
              <input
                id="login-email"
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse email"
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Mot de passe *</label>
            <div className="auth-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer' : 'Afficher'}
                tabIndex={-1}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>
          <div className="auth-options">
            <label className="auth-remember">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Se souvenir de moi
            </label>
            <Link to="/forgot-password" className="auth-forgot">Mot de passe oublié ?</Link>
          </div>
          <button type="submit" className="auth-btn-submit" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <p className="auth-footer-text">
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </p>
      </div>
      <div className="auth-split-visual">
        <AuthVisual />
      </div>
    </div>
  );
}
