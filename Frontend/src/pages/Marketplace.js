import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';
import './Marketplace.css';

function Marketplace() {
  const [flavors, setFlavors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFlavors();
  }, []);

  const loadFlavors = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getFlavors();
      setFlavors(result.flavors || []);
    } catch (err) {
      console.error('Error loading flavors:', err);
      setError('Impossible de charger les configurations');
    } finally {
      setLoading(false);
    }
  };

  const formatRAM = (ram) => {
    if (ram >= 1024) return `${(ram / 1024).toFixed(0)} GB`;
    return `${ram} MB`;
  };

  const formatPriceFCFA = (price) => {
    if (price == null) return '—';
    return `${Number(price).toLocaleString('fr-FR')} FCFA`;
  };

  /* Badge "Le plus utilisé" sur le 2e flavor s'il y en a au moins 2 */
  const mostUsedIndex = flavors.length >= 2 ? 1 : -1;

  if (loading) {
    return (
      <div className="marketplace-wrap">
        <div className="marketplace-loading">
          <div className="marketplace-spinner" />
          <p>Chargement du marketplace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-wrap">
        <div className="marketplace-error">
          <strong>Erreur</strong> {error}
          <button type="button" onClick={loadFlavors} className="marketplace-btn-retry">Réessayer</button>
        </div>
      </div>
    );
  }

  if (flavors.length === 0) {
    return (
      <div className="marketplace-wrap">
        <div className="marketplace-empty">
          <p>Aucune configuration disponible pour le moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-wrap">
      <div className="marketplace-cards">
        {flavors.map((flavor, index) => (
          <div key={flavor.id} className="marketplace-card">
            {index === mostUsedIndex && (
              <div className="marketplace-card-badge">Le plus utilisé</div>
            )}
            <h3 className="marketplace-card-title">{flavor.name}</h3>
            <p className="marketplace-card-desc">
              {flavor.description || `${formatRAM(flavor.ram)} RAM, ${flavor.vcpus || 0} vCPU — Idéal pour vos projets.`}
            </p>
            <div className="marketplace-price-wrap">
              <span className="marketplace-price-main">{formatPriceFCFA(flavor.price).replace(/\sFCFA$/, '')}</span>
              <span className="marketplace-price-decimal"> FCFA</span>
            </div>
            <p className="marketplace-price-period">Par mois</p>
            <ul className="marketplace-features">
              <li>{formatRAM(flavor.ram)} RAM</li>
              <li>{flavor.vcpus || '—'} vCPU</li>
              <li>{flavor.disk != null ? `${flavor.disk} GB` : '—'} disque</li>
              <li>Support inclus</li>
            </ul>
            <Link
              to="/client/create"
              state={{ selectedFlavor: flavor }}
              className="marketplace-btn-buy"
            >
              Créer avec cette config
            </Link>
          </div>
        ))}
      </div>
      <div className="marketplace-footer-note">
        <p>Tous les prix sont mensuels en FCFA. Pas de frais cachés. Annulez à tout moment.</p>
      </div>
    </div>
  );
}

export default Marketplace;
