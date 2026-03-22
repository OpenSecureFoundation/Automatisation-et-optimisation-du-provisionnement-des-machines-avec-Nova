# VM Marketplace - Plateforme de Gestion de Machines Virtuelles

Une application web moderne pour la vente et la gestion de machines virtuelles basée sur OpenStack.

![Status](https://img.shields.io/badge/status-active-success.svg)
![Node](https://img.shields.io/badge/node-20.x-blue.svg)
![React](https://img.shields.io/badge/react-18.x-blue.svg)
![OpenStack](https://img.shields.io/badge/openstack-Yoga-red.svg)

## Fonctionnalités

- **Dashboard Interactif** : Vue d'ensemble complète de votre infrastructure
- **Marketplace** : Catalogue de configurations VM avec tarification en XAF
- **Gestion de VMs** : Créer, démarrer, arrêter, redémarrer et supprimer des VMs
- **Scaling Automatique** : Scale up/down automatique basé sur CPU et RAM
- **Facturation Automatique** : Génération de factures toutes les 10 minutes selon l'utilisation réelle
- **Métriques en temps réel** : Surveillance CPU, RAM, disque et réseau via Gnocchi
- **Notifications** : Alertes en temps réel pour les événements importants
- **Intégration OpenStack** : Communication directe avec les APIs Nova, Keystone, Glance, Neutron, Gnocchi et Ceilometer
- **Interface Moderne** : Design responsive et intuitif

## Prérequis

- Serveur Ubuntu 22.04 ou 24.04
- 8 Go RAM minimum (16 Go recommandé)
- 100 Go de stockage minimum
- OpenStack installé et configuré avec les services suivants :
  - Nova (Compute)
  - Keystone (Identity)
  - Glance (Image)
  - Neutron (Network)
  - Ceilometer (Telemetry)
  - Gnocchi (Metrics)
  - Placement
  - Horizon (Dashboard)
- Node.js 20.x ou supérieur
- SQLite (inclus avec Node.js, aucune installation séparée)
- PM2
- Nginx

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌──────────────────────┐
│             │         │             │         │      OpenStack        │
│  Frontend   │────────▶│   Backend   │────────▶│  Nova / Keystone     │
│  (React)    │         │  (Node.js)  │         │  Glance / Neutron    │
│             │         │             │         │  Gnocchi / Ceilometer│
└─────────────┘         └─────────────┘         └──────────────────────┘
      │                        │
      └────────────┬───────────┘
                   │
              ┌────▼────┐
              │  Nginx  │
              │  Proxy  │
              └─────────┘
                   │
              ┌────▼────────┐
              │ PostgreSQL  │
              └─────────────┘
```

## Structure du Projet

```
Devstack/
├── Backend/                        # API Node.js/Express
│   ├── config/                    # Configuration OpenStack et base de données
│   ├── controllers/               # Contrôleurs (scaling, billing, admin)
│   ├── middleware/                # Authentification JWT
│   ├── migrations/                # Migrations base de données
│   ├── models/                    # Modèles Sequelize (VM, User, Invoice...)
│   ├── routes/                    # Routes API
│   ├── services/                  # Services métier
│   │   ├── autoScaler.js         # Moteur de scaling automatique
│   │   ├── billingEngine.js      # Moteur de facturation
│   │   ├── gnocchi.js            # Collecte métriques Gnocchi
│   │   ├── metricsCollector.js   # Collecte et analyse des métriques
│   │   ├── metricsMonitor.js     # Surveillance des seuils
│   │   └── notificationService.js# Service de notifications
│   ├── utils/                     # Utilitaires (logger, envDebug)
│   ├── server.js                  # Serveur principal
│   └── package.json              # Dépendances Backend
│
├── Frontend/                       # Application React
│   ├── public/                    # Fichiers statiques
│   ├── src/
│   │   ├── pages/                # Pages de l'application
│   │   ├── services/             # Services API
│   │   ├── App.js                # Composant principal
│   │   └── config.js             # Configuration Frontend
│   └── package.json              # Dépendances Frontend
│
├── nginx-config.conf              # Configuration Nginx
└── README.md                      # Ce fichier
```

## Scaling Automatique

Le système de scaling vertical surveille en permanence les métriques de chaque VM et ajuste automatiquement les ressources selon les seuils configurés.

### Fonctionnement

```
Métriques collectées toutes les 30 secondes (Gnocchi)
        ↓
Vérification des seuils toutes les 30 secondes
        ↓
CPU ou RAM > 80% → Scale Up automatique
CPU ET RAM < 20% → Scale Down automatique
        ↓
Cooldown de 3 minutes entre chaque scaling
        ↓
Confirmation du resize en 1 minutes 30 secondes
```

### Configuration de la politique de scaling

```bash
PUT /api/vms/:id/scaling-policy
{
  "metricType": "cpu_and_memory",
  "thresholdHigh": 80,
  "thresholdLow": 20,
  "cooldownMinutes": 5,
  "isActive": true
}
```

## Facturation Automatique

La facturation est basée sur l'utilisation réelle des VMs :

- Génération automatique toutes les **10 minutes**
- Facturation **uniquement si la VM est allumée**
- Calcul au prorata de la durée d'utilisation réelle
- Prise en compte des **événements de scaling** dans la facture
- Devise : **XAF (Franc CFA)**
- Paiement manuel ou automatique par carte

### Tarification

| Ressource | Prix |
|---|---|
| CPU (par vCPU/heure) | 200 XAF |
| RAM (par Go/heure) | 50 XAF |
| Stockage (par Go/heure) | 0.01 XAF |

## Installation

### Étape 1 — Cloner le depot

git clone <url-du-repo> nom_dossier
cd nom_Dossier

### Étape 2 — Backend

```bash
# Aller dans le dossier Backend
cd Backend

# Installer les dépendances
npm install

# Configurer le fichier .env (OBLIGATOIRE)
cp .env.example .env
# Ouvrir et modifier .env avec vos valeurs OpenStack
nano .env

# Lancer les migrations (crée la base de données SQLite)
npm run migrate

# Démarrer le backend
npm start
```

### Étape 3 — Frontend

```bash
# Ouvrir un nouveau terminal
# Aller dans le dossier Frontend
cd Frontend

# Installer les dépendances
npm install

# Démarrer le frontend
npm start
```

> **Note** : Le frontend n'a pas besoin de fichier `.env`. Toute la configuration se fait uniquement dans le `.env` du Backend.

## Déploiement sur serveur Ubuntu

Si vous copiez le projet dans `/var/www/`, vous devez donner les droits à votre utilisateur sur le dossier :

```bash
# Copier le projet
sudo cp -r nom_Dossier/ /var/www/nom_dossier

# Donner les droits à votre utilisateur (remplacez "root" par votre utilisateur)
sudo chown -R root:root /var/www/nom_dossier

# Donner les permissions sur le dossier Backend (pour SQLite)
sudo chmod -R 755 /var/www/nom_dossier/Backend

# Aller dans le Backend
cd /var/www/nom_dossier/Backend

# Installer les dépendances
npm install

# Créer et configurer le .env
cp .env.example .env
nano .env

# Lancer les migrations
npm run migrate

# Démarrer avec PM2
pm2 start server.js --name backend
pm2 save

# Ou manunuellement
npm start

# Aller dans le Frontend
cd /var/www/Devstack/Frontend
npm install
pm2 start npm --name frontend -- start
pm2 save

# Ou manunuellement
npm start
```


### Backend (.env) — Seul fichier à configurer

Copiez ce contenu dans `Backend/.env` et remplacez `VOTRE_IP` par l'adresse IP de votre serveur OpenStack :

```env
# ── OpenStack — Authentification ──
OS_USERNAME=admin
OS_PASSWORD=VotreMotDePasse
OS_PROJECT_NAME=admin
OS_AUTH_URL=http://VOTRE_IP:5000/v3
OS_USER_DOMAIN_NAME=Default
OS_PROJECT_DOMAIN_NAME=Default
OS_IDENTITY_API_VERSION=3

# ── OpenStack — Services ──
KEYSTONE_URL=http://VOTRE_IP:5000/v3
NOVA_URL=http://VOTRE_IP:8774/v2.1
NEUTRON_URL=http://VOTRE_IP:9696
GLANCE_URL=http://VOTRE_IP:9292
CINDER_URL=http://VOTRE_IP:8776/v3
HEAT_URL=http://VOTRE_IP:8004/v1
GNOCCHI_URL=http://VOTRE_IP:8041
AODH_URL=http://VOTRE_IP:8042
PLACEMENT_URL=http://VOTRE_IP:8778

# ── Application ──
JWT_SECRET=VotreSecretJWT
PORT=3001
NODE_ENV=production

# ── Base de données SQLite (optionnel) ──
# Par défaut le fichier database.sqlite est créé automatiquement
# SQLITE_PATH=./database.sqlite
# DB_ALTER=true
# SQL_LOG=false

# ── Gnocchi — métriques CPU/RAM (optionnel) ──
# GNOCCHI_TIMEOUT_MS=12000
# GNOCCHI_RETRIES=1
# GNOCCHI_ERROR_THROTTLE_MS=60000

# ── Console noVNC (optionnel) ──
# NOVA_CONSOLE_MICROVERSION=2.6
# NOVNC_PUBLIC_BASE_URL=http://VOTRE_IP:6080

# ── Streaming métriques live (optionnel) ──
# METRICS_STREAM_INTERVAL_MS=10000

# ── Facturation (optionnel) ──
# BILLING_OVERDUE_AFTER_DAYS=7

# ── Multi-tenant Keystone (optionnel) ──
# KEYSTONE_MULTI_TENANT=true

# ── OAuth Google (optionnel) ──
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

## API Endpoints

### Health Check
```
GET /api/health
```

### VMs
```
GET    /api/vms                        # Liste des VMs
POST   /api/vms                        # Créer une VM
GET    /api/vms/:id                    # Détails d'une VM
DELETE /api/vms/:id                    # Supprimer une VM
POST   /api/vms/:id/action             # Action (start, stop, reboot...)
GET    /api/vms/:id/metrics            # Métriques de la VM
GET    /api/vms/:id/scaling-policy     # Politique de scaling
PUT    /api/vms/:id/scaling-policy     # Configurer le scaling
GET    /api/vms/:id/scaling-history    # Historique des scalings
GET    /api/vms/:id/console            # Console VNC
```

### Facturation
```
GET  /api/invoices              # Liste des factures
GET  /api/invoices/:id          # Détails d'une facture
GET  /api/invoices/:id/download # Télécharger en PDF
POST /api/invoices/:id/pay      # Payer une facture
GET  /api/pricing-rules         # Règles tarifaires
```

### Flavors & Images
```
GET /api/flavors          # Liste des configurations
GET /api/images           # Liste des images OS
GET /api/openstack/status # Statut OpenStack
```

## Commandes Utiles

### PM2

```bash
pm2 list                  # Statut des applications
pm2 logs backend          # Logs du backend
pm2 restart backend       # Redémarrer le backend
pm2 stop all              # Arrêter tout
pm2 monit                 # Monitoring en temps réel
```

### OpenStack

```bash
source /home/user/admin-openrc

openstack server list     # Liste des VMs
openstack flavor list     # Liste des configurations
openstack image list      # Liste des images
openstack network list    # Liste des réseaux
```

## Dépannage

### Le Backend ne se connecte pas à OpenStack

```bash
# Vérifier que OpenStack est en cours d'exécution
openstack service list

# Vérifier les logs du backend
pm2 logs backend --lines 50
```

### Le scaling ne se déclenche pas

```bash
# Vérifier que la ScalingPolicy est active
node -e "require('dotenv').config(); const { ScalingPolicy } = require('./models'); ScalingPolicy.findAll({ where: { isActive: true } }).then(p => console.log(p.length, 'policies actives')).catch(console.error);"

# Vérifier que Gnocchi remonte des métriques
TOKEN=$(openstack token issue -f value -c id)
curl -H "X-Auth-Token: $TOKEN" http://VOTRE_IP:8041/v1/status
```

### Nginx retourne 502 Bad Gateway

```bash
pm2 status
pm2 restart backend
sudo systemctl restart nginx
```

## Sécurité

1. Changez tous les mots de passe par défaut
2. Configurez un certificat SSL avec Let's Encrypt
3. Utilisez un pare-feu (UFW)
4. Limitez l'accès SSH par clé
5. Ne committez jamais votre fichier `.env`

## Sauvegarde

```bash
# Sauvegarder le projet sans node_modules
zip -r backup-$(date +%Y%m%d).zip nom_dossier/ -x "*/node_modules/*"

# Sauvegarder uniquement les fichiers importants
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  Backend/.env \
  Backend/database.sqlite \
  /etc/nginx/sites-available/vm-marketplace
```

## Roadmap

- [x] Authentification utilisateur (JWT)
- [x] Tableau de bord admin
- [x] Facturation automatique (XAF)
- [~] Auto-scaling vertical des VMs
- [~] Métriques en temps réel (Gnocchi/Ceilometer)
- [x] Historique des scalings
- [x] Notifications en temps réel
- [ ] Support multi-régions
- [ ] Monitoring avancé (Grafana)
- [ ] API REST documentée (Swagger)
- [ ] Tests unitaires et d'intégration

---

**Auteurs** : YAKAM Rick & MEMEZAGUE Fabiola
