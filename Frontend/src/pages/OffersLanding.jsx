import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';
import './OffersLanding.css';

const DEFAULT_OFFERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 3000,
    period: 'mois',
    features: ['1 vCPU', '512 MB RAM', '10 GB SSD', 'Support communauté'],
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 15000,
    period: 'mois',
    features: ['2 vCPUs', '4 GB RAM', '80 GB SSD', 'Support prioritaire', 'Sauvegardes incluses'],
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 30000,
    period: 'mois',
    features: ['4 vCPUs', '8 GB RAM', '160 GB SSD', 'Support 24/7', 'SLA 99.9%', 'IP dédiée'],
    recommended: false,
  },
];

function formatRAM(ram) {
  if (ram >= 1024) return `${(ram / 1024).toFixed(0)} GB`;
  return `${ram} MB`;
}

function formatPriceFCFA(price) {
  if (price == null) return '—';
  return `${Number(price).toLocaleString('fr-FR')} FCFA`;
}

function OffersLanding() {
  const [offers, setOffers] = useState(DEFAULT_OFFERS);
  const [loading, setLoading] = useState(true);
  const [useFlavors, setUseFlavors] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getFlavors()
      .then((result) => {
        if (cancelled || !result.flavors?.length) return;
        const flavors = result.flavors.slice(0, 3);
        const withPricing = flavors.map((f, i) => ({
          id: f.id,
          name: f.name,
          price: f.price ?? DEFAULT_OFFERS[i]?.price ?? 10 * (i + 1),
          period: 'mois',
          features: [
            `${f.vcpus || 1} vCPU`,
            `${formatRAM(f.ram || 512)} RAM`,
            `${f.disk || 20} GB disque`,
            'Support inclus',
          ],
          recommended: i === 1,
        }));
        setOffers(withPricing);
        setUseFlavors(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="offers-landing">
      <section className="offers-hero">
        <div className="offers-hero-shapes" aria-hidden="true">
          <span className="offers-hero-shape offers-hero-shape-1" />
          <span className="offers-hero-shape offers-hero-shape-2" />
          <span className="offers-hero-shape offers-hero-shape-3" />
        </div>
        <h1 className="offers-hero-title">VPS Cloud simple et performant</h1>
        <p className="offers-hero-subtitle">
          Démarrez en quelques minutes avec des machines virtuelles fiables, facturées au mois.
          Inspiré des offres des meilleurs hébergeurs.
        </p>
        <div className="offers-hero-cta">
          <Link to="/register" className="offers-btn offers-btn-primary">
            Créer un compte
          </Link>
          <Link to="/marketplace" className="offers-btn offers-btn-secondary">
            Voir le marketplace
          </Link>
        </div>
        <p className="offers-hero-note">Sans engagement. Résiliez quand vous voulez.</p>
      </section>

      <section className="offers-plans">
        <h2 className="offers-plans-title">Choisissez votre offre</h2>
        <p className="offers-plans-subtitle">
          Toutes les offres incluent accès root, IPv4 et support.
        </p>
        {loading ? (
          <div className="offers-loading">
            <div className="offers-spinner" />
            <p>Chargement des offres...</p>
          </div>
        ) : (
          <div className="offers-cards">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`offers-card ${offer.recommended ? 'offers-card-recommended' : ''}`}
              >
                {offer.recommended && <span className="offers-card-badge">Recommandé</span>}
                <div className="offers-card-header">
                  <h3 className="offers-card-name">{offer.name}</h3>
                  <div className="offers-card-price">
                    <span className="offers-card-amount">{formatPriceFCFA(offer.price)}</span>
                    <span className="offers-card-period">/ {offer.period}</span>
                  </div>
                </div>
                <ul className="offers-card-features">
                  {offer.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`offers-btn offers-card-btn ${offer.recommended ? 'offers-btn-primary' : 'offers-btn-outline'}`}
                >
                  Choisir
                </Link>
                <span className="offers-card-note">Sans engagement</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="offers-cta-bottom">
        <h2 className="offers-cta-title">Prêt à commencer ?</h2>
        <p className="offers-cta-text">Créez votre compte et déployez votre premier VPS en quelques clics.</p>
        <Link to="/register" className="offers-btn offers-btn-primary offers-btn-lg">
          Créer un compte
        </Link>
      </section>
    </div>
  );
}

export default OffersLanding;
