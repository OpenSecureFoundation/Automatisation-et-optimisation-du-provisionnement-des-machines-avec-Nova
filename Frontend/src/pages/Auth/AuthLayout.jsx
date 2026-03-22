import React from 'react';

/**
 * Layout pour les pages d'authentification (connexion / inscription).
 * Pas de navbar applicative — uniquement le formulaire centré.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      {children}
    </div>
  );
}
