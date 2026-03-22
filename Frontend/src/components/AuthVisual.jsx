import React from 'react';

/** Panneau décoratif droit des pages Auth (formes géométriques abstraites) */
export default function AuthVisual() {
  return (
    <div className="auth-visual">
      <div className="auth-visual-bg" />
      <div className="auth-visual-shapes">
        <div className="auth-shape auth-shape-circle-1" />
        <div className="auth-shape auth-shape-circle-2" />
        <div className="auth-shape auth-shape-circle-3" />
        <div className="auth-shape auth-shape-ring" />
        <div className="auth-shape auth-shape-rect" />
        <div className="auth-shape auth-shape-block" />
        <div className="auth-shape auth-shape-star">★</div>
        <div className="auth-shape auth-shape-dots" />
        <div className="auth-shape auth-shape-line-wavy" />
        <div className="auth-shape auth-shape-burst" />
      </div>
    </div>
  );
}
