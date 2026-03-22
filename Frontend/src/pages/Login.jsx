import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthVisual from '../components/AuthVisual';
import './Auth.css';

const REMEMBER_KEY = 'vm-marketplace-remember-email';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

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
      await login(email, password);
      if (rememberMe) {
        try { localStorage.setItem(REMEMBER_KEY, email); } catch (_) {}
      } else {
        try { localStorage.removeItem(REMEMBER_KEY); } catch (_) {}
      }
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        (err.response?.status === 0 || err.code === 'ERR_NETWORK' ? 'Connexion au serveur impossible.' : 'Connexion impossible');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split">
      <div className="auth-split-form">
        <Link to="/" className="auth-logo" aria-label="Accueil">
          <span className="auth-logo-icon" aria-hidden="true">VM</span>
          <span>VM Marketplace</span>
        </Link>
        <h1>Bienvenue</h1>
        <p className="auth-subtitle">
          Connectez-vous pour accéder à vos VPS et à votre espace.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-alert" role="alert">
              {error}
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">
              Email *
            </label>
            <div className="auth-input-wrap without-toggle">
              <input
                id="login-email"
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Entrez votre adresse email"
                autoComplete="email"
                required
              />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">
              Mot de passe *
            </label>
            <div className="auth-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                tabIndex={-1}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>
          <div className="auth-options">
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Se souvenir de moi
            </label>
            <Link to="/forgot-password" className="auth-forgot">
              Mot de passe oublié ?
            </Link>
          </div>
          <button type="submit" className="auth-btn-submit" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
          <div className="auth-divider">Ou se connecter avec</div>
          <button
            type="button"
            className="auth-google-btn"
            disabled
            title="Bientôt disponible"
          >
            <span aria-hidden>G</span>
            Connexion avec Google (bientôt)
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
