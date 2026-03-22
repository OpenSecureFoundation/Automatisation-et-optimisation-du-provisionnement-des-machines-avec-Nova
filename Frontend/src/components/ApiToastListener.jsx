import { useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * Écoute les événements 'api-toast' dispatchés par api.js (hors React)
 * pour afficher des toasts sur erreur 401/5xx.
 */
export default function ApiToastListener() {
  useEffect(() => {
    const handler = (e) => {
      const { type = 'error', message } = e.detail || {};
      if (type === 'error') toast.error(message);
      else if (type === 'success') toast.success(message);
      else toast(message);
    };
    window.addEventListener('api-toast', handler);
    return () => window.removeEventListener('api-toast', handler);
  }, []);

  return null;
}
