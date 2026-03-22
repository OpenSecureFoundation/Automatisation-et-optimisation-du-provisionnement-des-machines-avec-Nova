import React, { useCallback, useEffect, useState } from 'react';
import { Chip } from './ui';
import apiService from '../services/api';

export default function OpenstackStatusBadge() {
  const [status, setStatus] = useState('loading');

  const refreshStatus = useCallback(async () => {
    try {
      const res = await apiService.getOpenstackStatus();
      setStatus(res?.connected ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  if (status === 'loading') {
    return <Chip size="sm" variant="flat">Connexion...</Chip>;
  }

  return status === 'ok'
    ? <Chip size="sm" color="success" variant="flat">OpenStack OK</Chip>
    : <Chip size="sm" color="danger" variant="flat">OpenStack KO</Chip>;
}

