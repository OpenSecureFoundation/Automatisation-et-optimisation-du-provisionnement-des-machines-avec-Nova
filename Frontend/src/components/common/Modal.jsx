import React, { useEffect } from 'react';

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) {
      const handler = (e) => e.key === 'Escape' && onClose?.();
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handler);
        document.body.style.overflow = '';
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">{title}</h2>
            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
