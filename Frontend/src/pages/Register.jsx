import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthVisual from '../components/AuthVisual';
import './Auth.css';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register({ email, password, name: name || undefined });
      navigate('/', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      const errObj = data?.error;
      const details = errObj?.details;
      const firstDetail = Array.isArray(details) ? details[0] : null;
      const msg =
        errObj?.message ||
        (firstDetail && (firstDetail.msg || firstDetail.message)) ||
        (data?.message) ||
        (err.response?.status === 0 || err.code === 'ERR_NETWORK'
          ? 'Connexion au serveur impossible. Vérifiez que le backend est démarré.'
          : 'Inscription impossible');
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
        <h1>Créer un compte</h1>
        <p className="auth-subtitle">
          Inscrivez-vous pour accéder aux VPS et à la plateforme.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-alert" role="alert">
              {error}
            </div>
          )}
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-email">
              Email *
            </label>
            <div className="auth-input-wrap without-toggle">
              <input
                id="reg-email"
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
            <label className="auth-label" htmlFor="reg-name">
              Nom (optionnel)
            </label>
            <div className="auth-input-wrap without-toggle">
              <input
                id="reg-name"
                type="text"
                className="auth-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                autoComplete="name"
              />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="reg-password">
              Mot de passe * (min. 8 caractères, 1 chiffre)
            </label>
            <div className="auth-input-wrap">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez votre mot de passe"
                autoComplete="new-password"
                minLength={8}
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
          <button type="submit" className="auth-btn-submit" disabled={submitting}>
            {submitting ? 'Inscription...' : 'S\'inscrire'}
          </button>
          <div className="auth-divider">Ou s'inscrire avec</div>
          <button
            type="button"
            className="auth-google-btn"
            disabled
            title="Bientôt disponible"
          >
            <span aria-hidden>G</span>
            Inscription avec Google (bientôt)
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
