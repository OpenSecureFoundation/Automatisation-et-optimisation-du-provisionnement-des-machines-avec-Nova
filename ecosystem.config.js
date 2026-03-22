/**
 * PM2 Ecosystem — VM Marketplace
 *
 * IMPORTANT avant de démarrer en production :
 *   cd Frontend && npm run build
 * Le script start:prod (`serve -s build`) sert le dossier build/
 * Un build absent ou obsolète donnera une page blanche ou une 404.
 *
 * Pour automatiser : ajouter `npm run build` dans le script de déploiement
 * AVANT `pm2 restart vm-marketplace-frontend`.
 */
module.exports = {
  apps: [
    {
      name: 'vm-marketplace-backend',
      cwd: './Backend',
      script: 'server.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Redémarre automatiquement si le process plante
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: 'vm-marketplace-frontend',
      cwd: './Frontend',
      script: 'npm',
      args: 'run start:prod',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        // URLs relatives → Nginx proxy /api/ vers backend:3001
        REACT_APP_API_URL: '',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        REACT_APP_API_URL: '',
      },
      // Ne pas redémarrer si le build est absent (évite boucle infinie)
      restart_delay: 5000,
      max_restarts: 5,
    },
  ],
};
