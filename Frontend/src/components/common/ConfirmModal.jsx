import React, { useEffect } from 'react';
import { Modal } from './Modal';

/**
 * Confirmation dialog with liquid-glass style. Replaces window.confirm.
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {() => void} onConfirm
 * @param {string} title
 * @param {string} message
 * @param {string} confirmLabel - e.g. "Supprimer"
 * @param {string} cancelLabel - e.g. "Annuler"
 * @param {string} variant - 'danger' | 'primary' | 'default' for confirm button
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default'
}) {
  useEffect(() => {
    if (open) {
      const handler = (e) => e.key === 'Escape' && onClose?.();
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm?.();
    onClose?.();
  };

  const btnClass = variant === 'danger'
    ? 'confirm-modal-btn confirm-modal-btn-danger'
    : variant === 'primary'
      ? 'confirm-modal-btn confirm-modal-btn-primary'
      : 'confirm-modal-btn confirm-modal-btn-default';

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="confirm-modal-liquid">
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-btn confirm-modal-btn-cancel" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={btnClass} onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
