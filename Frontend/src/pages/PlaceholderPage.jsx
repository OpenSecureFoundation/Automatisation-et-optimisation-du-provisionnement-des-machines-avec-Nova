import React from 'react';
import './PlaceholderPage.css';

export default function PlaceholderPage({ title = 'Page', message = 'Cette section sera bientôt disponible.' }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-card">
        <h2 className="placeholder-title">{title}</h2>
        <p className="placeholder-message">{message}</p>
      </div>
    </div>
  );
}
