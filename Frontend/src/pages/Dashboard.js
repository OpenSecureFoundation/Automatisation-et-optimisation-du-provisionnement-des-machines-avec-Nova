import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import apiService from '../services/api';
import { API } from '../config';

function Dashboard() {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/client';
  const [stats, setStats] = useState({
    totalVMs: 0,
    activeVMs: 0,
    totalFlavors: 0,
    totalImages: 0
  });
  const [openstackStatus, setOpenstackStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Dashboard] Chargement des données...');

      const statusResult = await apiService.getOpenstackStatus();
      console.log('[Dashboard] OpenStack status OK');
      setOpenstackStatus(statusResult);

      const vmsResult = await apiService.getVMs();
      const activeVMs = (vmsResult.servers || []).filter(vm => vm.status === 'ACTIVE').length;
      console.log('[Dashboard] VMs OK', vmsResult.count);

      const flavorsResult = await apiService.getFlavors();
      console.log('[Dashboard] Flavors OK', flavorsResult.count);

      const imagesResult = await apiService.getImages();
      console.log('[Dashboard] Images OK', imagesResult.count);

      setStats({
        totalVMs: vmsResult.count || 0,
        activeVMs: activeVMs,
        totalFlavors: flavorsResult.count || 0,
        totalImages: imagesResult.count || 0
      });
    } catch (err) {
      console.error('[Dashboard] Erreur chargement:', err);
      console.error('[Dashboard] err.response:', err.response?.status, err.response?.data);
      console.error('[Dashboard] err.message:', err.message, 'code:', err.code);
      const msg = err.response?.data?.error?.message || err.response?.data?.message ||
        (err.code === 'ERR_NETWORK' ? 'Connexion au serveur impossible.' : 'Impossible de charger les données du dashboard');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem', color: 'white' }}>Chargement du dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <strong>Erreur:</strong> {error}
        <button onClick={loadDashboardData} className="btn btn-sm btn-primary" style={{ marginLeft: '1rem' }}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <h1 className="card-title">Dashboard</h1>
          <p className="card-subtitle">Vue d'ensemble de votre infrastructure</p>
        </div>
        
        {openstackStatus && (
          <div className={`alert ${openstackStatus.connected ? 'alert-success' : 'alert-error'}`}>
            <strong>OpenStack:</strong> {openstackStatus.message}
          </div>
        )}
      </div>

      <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true" />
          <div className="stat-value">{stats.totalVMs}</div>
          <div className="stat-label">VMs Totales</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true" />
          <div className="stat-value">{stats.activeVMs}</div>
          <div className="stat-label">VMs Actives</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true" />
          <div className="stat-value">{stats.totalFlavors}</div>
          <div className="stat-label">Configurations</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true" />
          <div className="stat-value">{stats.totalImages}</div>
          <div className="stat-label">Images OS</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Actions Rapides</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link to={`${basePath}/create`} className="btn btn-primary">
              Créer une nouvelle VM
            </Link>
            <Link to={`${basePath}/marketplace`} className="btn btn-secondary">
              Explorer le Marketplace
            </Link>
            <Link to={`${basePath}/vms`} className="btn btn-secondary">
              Gérer mes VMs
            </Link>
            <a href={API.OPENSTACK_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="btn btn-warning">
              Ouvrir OpenStack Dashboard
            </a>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Informations Système</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#f9fafb', borderRadius: '6px' }}>
              <span><strong>Backend:</strong></span>
              <span className="badge badge-success">En ligne</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#f9fafb', borderRadius: '6px' }}>
              <span><strong>OpenStack:</strong></span>
              <span className={`badge ${openstackStatus?.connected ? 'badge-success' : 'badge-danger'}`}>
                {openstackStatus?.connected ? 'Connecté' : 'Déconnecté'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#f9fafb', borderRadius: '6px' }}>
              <span><strong>Région:</strong></span>
              <span>RegionOne</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#f9fafb', borderRadius: '6px' }}>
              <span><strong>Project:</strong></span>
              <span>Admin</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>💡 Guide de démarrage rapide</h2>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
          <li>Explorez les <strong>configurations disponibles</strong> dans le Marketplace</li>
          <li>Créez votre première VM en cliquant sur <strong>"Créer VM"</strong></li>
          <li>Sélectionnez une <strong>image système</strong> (Ubuntu, CentOS, etc.)</li>
          <li>Choisissez une <strong>configuration</strong> (CPU, RAM, Disque)</li>
          <li>Lancez votre VM et gérez-la depuis <strong>"Mes VMs"</strong></li>
        </ol>
      </div>
    </div>
  );
}

export default Dashboard;

