import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Redirige les admins vers /admin s'ils accèdent à l'espace client.
 */
export function ClientGuard({ children }) {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
