const { Sequelize } = require('sequelize');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl && isProduction) {
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: process.env.SQL_LOG === 'true' ? console.log : false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  });
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_PATH || './database.sqlite',
    logging: process.env.SQL_LOG === 'true' ? console.log : false
  });
}

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    return true;
  } catch (err) {
    console.error('Unable to connect to the database:', err.message);
    return false;
  }
};

module.exports = { sequelize, testConnection };
