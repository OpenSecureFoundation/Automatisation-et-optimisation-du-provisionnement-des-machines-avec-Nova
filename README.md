Automatisation et optimisation du provisionnement des machines avec Nova
Projet d'automatisation et de l'optimisation du provisionnement des machines avec openStack nova

Objectifs :
• Créer un orchestrateur personnalisé pour le déploiement automatique de VM en fonction des besoins métiers

• Implémenter des politiques de planification avancées dans Nova pour optimiser l'utilisation des ressources
# VM Marketplace — Plateforme de Gestion de Machines Virtuelles

Une application web moderne pour la vente et la gestion de machines virtuelles basée sur OpenStack.

![Status](https://img.shields.io/badge/status-active-success.svg)
![Node](https://img.shields.io/badge/node-20.20.0-blue.svg)
![React](https://img.shields.io/badge/react-18.x-blue.svg)
![OpenStack](https://docs.openstack.org/nova/latest/)

---

##  Fonctionnalités

- **Dashboard Interactif** : Vue d'ensemble complète de votre infrastructure
- **Marketplace** : Catalogue de configurations VM avec tarification en XAF
- **Gestion de VMs** : Créer, démarrer, arrêter, redémarrer et supprimer des VMs
- **Scaling Automatique** : Scale up/down automatique basé sur CPU et RAM
- **Facturation Automatique** : Génération de factures toutes les 10 minutes selon l'utilisation réelle
- **Métriques en temps réel** : Surveillance CPU, RAM, disque et réseau via Gnocchi
- **Notifications** : Alertes en temps réel pour les événements importants
- **Intégration OpenStack** : Communication directe avec les APIs Nova, Keystone, Glance, Neutron, Gnocchi et Ceilometer
- **Interface Moderne** : Design responsive et intuitif

---

##  Prérequis

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
- Node.js 20.20.0 ou supérieur
- npm (inclus avec Node.js)
- SQLite (aucune installation séparée requise)
- PM2 (gestionnaire de processus Node.js)
- Nginx

---

##  Architecture

---

##  Structure du Projet

```
VMmarketplace/
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
│   │   └── notificationService.js # Service de notifications
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

---

##  Scaling Automatique

Le système de scaling vertical surveille en permanence les métriques de chaque VM et ajuste automatiquement les ressources selon les seuils configurés.

### Fonctionnement

```
Métriques collectées toutes les 2 minutes via Gnocchi
        ↓
Vérification des seuils toutes les 2 minutes
        ↓
CPU ou RAM > 80% → Scale Up automatique
CPU ET RAM < 20% → Scale Down automatique
        ↓
Cooldown de 5 minutes entre chaque scaling
        ↓
Confirmation du resize en 3 minutes
```

### Configuration de la politique de scaling via l'API

```
PUT /api/vms/:id/scaling-policy
{
  "metricType": "cpu_and_memory",
  "thresholdHigh": 80,
  "thresholdLow": 20,
  "cooldownMinutes": 5,
  "isActive": true
}
```

---

##  Facturation Automatique

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

---

##  Base de Données

Ce projet utilise **SQLite** — aucune installation externe n'est nécessaire. Le fichier `database.sqlite` est créé automatiquement lors de la migration.


##  Installation

### Étape 1 — Cloner le dépôt

```bash
git clone <https://github.com/OpenSecureFoundation/Automatisation-et-optimisation-du-provisionnement-des-machines-avec-Nova> VMmarketplace
cd VMmarketplace
```

### Étape 2 — Donner les droits sur le dossier (si déploiement sur serveur)

```bash
# Remplacez "votre_utilisateur" par votre nom d'utilisateur Linux
sudo chown -R votre_utilisateur:votre_utilisateur /var/www/VMmarketplace
sudo chmod -R 755 /var/www/VMmarketplace/Backend
```

### Étape 3 — Configurer le Backend

```bash
cd Backend

# Installer les dépendances
npm install

# Créer le fichier de configuration
cp .env.example .env

# Remplir le fichier .env avec vos valeurs OpenStack
nano .env

# Créer la base de données SQLite (migrations)
npm run migrate

# Démarrer le backend
npm start
```

### Étape 4 — Démarrer le Frontend

```bash
# Ouvrir un nouveau terminal
cd Frontend

# Installer les dépendances
npm install

# Démarrer le frontend
npm start
```

> **Note** : Le frontend n'a pas besoin de fichier `.env`. Toute la configuration se fait uniquement dans le `.env` du Backend.

---

##  Exemple — Fichier Backend/.env

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

---

##  API Endpoints

### Health Check
```
GET /api/health
```

### VMs
```
GET    /api/vms                     # Liste des VMs
POST   /api/vms                     # Créer une VM
GET    /api/vms/:id                 # Détails d'une VM
DELETE /api/vms/:id                 # Supprimer une VM
POST   /api/vms/:id/action          # Action (start, stop, reboot...)
GET    /api/vms/:id/metrics         # Métriques de la VM
GET    /api/vms/:id/scaling-policy  # Politique de scaling
PUT    /api/vms/:id/scaling-policy  # Configurer le scaling
GET    /api/vms/:id/scaling-history # Historique des scalings
GET    /api/vms/:id/console         # Console VNC
```

### Facturation
```
GET  /api/invoices               # Liste des factures
GET  /api/invoices/:id           # Détails d'une facture
GET  /api/invoices/:id/download  # Télécharger en PDF
POST /api/invoices/:id/pay       # Payer une facture
GET  /api/pricing-rules          # Règles tarifaires
```

### Flavors & Images
```
GET /api/flavors           # Liste des configurations
GET /api/images            # Liste des images OS
GET /api/openstack/status  # Statut OpenStack
```

---

##  Commandes Utiles

### PM2 — Gestion des processus

```bash
pm2 list               # Voir les applications qui tournent
pm2 logs backend       # Voir les logs du backend
pm2 restart backend    # Redémarrer le backend
pm2 stop all           # Arrêter toutes les applications
pm2 save               # Sauvegarder pour redémarrage automatique
pm2 monit              # Monitoring en temps réel
```

### OpenStack

```bash
# Charger les credentials OpenStack
source /home/votre_utilisateur/admin-openrc

openstack server list   # Liste des VMs
openstack flavor list   # Liste des configurations
openstack image list    # Liste des images
openstack network list  # Liste des réseaux
```

---

##  Dépannage

### Le Backend ne se connecte pas à OpenStack

```bash
# Vérifier que OpenStack est en cours d'exécution
openstack service list

# Vérifier les logs du backend
pm2 logs backend --lines 50
```

### Le scaling ne se déclenche pas

```bash
cd /var/www/VMmarketplace/Backend

# Vérifier que des politiques de scaling sont actives en base
node -e "require('dotenv').config(); const { ScalingPolicy } = require('./models'); ScalingPolicy.findAll({ where: { isActive: true } }).then(p => console.log(p.length, 'policies actives')).catch(console.error);"

# Vérifier que Gnocchi est accessible
TOKEN=$(openstack token issue -f value -c id)
curl -H "X-Auth-Token: $TOKEN" http://VOTRE_IP:8041/v1/status
```

### Nginx retourne 502 Bad Gateway

```bash
pm2 status
pm2 restart backend
sudo systemctl restart nginx
```


---
