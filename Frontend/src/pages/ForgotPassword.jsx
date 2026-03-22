import React from 'react';
import { Link } from 'react-router-dom';
import AuthVisual from '../components/AuthVisual';
import './Auth.css';

export default function ForgotPassword() {
  return (
    <div className="auth-split">
      <div className="auth-split-form">
        <Link to="/login" className="auth-logo" aria-label="VM Marketplace">
          <span className="auth-logo-icon" aria-hidden="true">VM</span>
          <span>VM Marketplace</span>
        </Link>
        <h1>Mot de passe oublié</h1>
        <p className="auth-subtitle">
          La réinitialisation par email sera disponible prochainement. En attendant, contactez le support.
        </p>
        <p className="auth-footer-text">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </div>
      <div className="auth-split-visual">
        <AuthVisual />
      </div>
    </div>
  );
}
