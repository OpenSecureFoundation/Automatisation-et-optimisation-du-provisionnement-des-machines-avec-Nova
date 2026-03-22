import React from 'react';

export function LoadingSpinner({ message = 'Chargement...' }) {
  return (
    <div className="loading" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
      {message && <p style={{ marginTop: '1rem', color: 'inherit' }}>{message}</p>}
    </div>
  );
}
