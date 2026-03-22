const path = require('path');
const { sequelize, testConnection } = require('../config/database');
const { Umzug, SequelizeStorage } = require('umzug');
const User = require('./User');
const VM = require('./VM');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const ScalingPolicy = require('./ScalingPolicy');
const ScalingEvent = require('./ScalingEvent');
const ResourceUsage = require('./ResourceUsage');
const PricingRule = require('./PricingRule');
const VmRuntime = require('./VmRuntime');
const VMTemplate = require('./VMTemplate');
const GlobalScaleUpRule = require('./GlobalScaleUpRule');
const PaymentMethod = require('./PaymentMethod');
const UsageSlice = require('./UsageSlice');
const Notification = require('./Notification');

// ──────────────────────────────────────────────────────────────────
// Associations — utiliser des alias cohérents PARTOUT
// Règle : VM.belongsTo(User, { as: 'User' }) et include: { model: User, as: 'User' }
// ──────────────────────────────────────────────────────────────────

// User <-> VM
User.hasMany(VM, { foreignKey: 'userId', as: 'VMs' });
VM.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// VM <-> ResourceUsage
VM.hasMany(ResourceUsage, { foreignKey: 'vmId', as: 'ResourceUsages' });
ResourceUsage.belongsTo(VM, { foreignKey: 'vmId', as: 'VM' });

// User <-> Invoice
User.hasMany(Invoice, { foreignKey: 'userId', as: 'Invoices' });
Invoice.belongsTo(User, { foreignKey: 'userId', as: 'User' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'InvoiceItems' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'Invoice' });

// User <-> VmRuntime
User.hasMany(VmRuntime, { foreignKey: 'userId', as: 'VmRuntimes' });
VmRuntime.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// User <-> PaymentMethod
User.hasMany(PaymentMethod, { foreignKey: 'userId', as: 'PaymentMethods' });
PaymentMethod.belongsTo(User, { foreignKey: 'userId', as: 'User' });

// User <-> UsageSlice
User.hasMany(UsageSlice, { foreignKey: 'userId', as: 'UsageSlices' });
UsageSlice.belongsTo(User, { foreignKey: 'userId', as: 'User' });
Invoice.hasMany(UsageSlice, { foreignKey: 'invoiceId', as: 'UsageSlices' });
UsageSlice.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'Invoice' });

// User <-> Notification
User.hasMany(Notification, { foreignKey: 'userId', as: 'Notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'User' });

const models = {
  User,
  VM,
  Invoice,
  InvoiceItem,
  ScalingPolicy,
  ScalingEvent,
  ResourceUsage,
  PricingRule,
  VmRuntime,
  VMTemplate,
  GlobalScaleUpRule,
  PaymentMethod,
  UsageSlice,
  Notification
};

const syncDatabase = async (options = {}) => {
  const dialect = sequelize.getDialect();
  const useAlter = options.alter ?? (process.env.DB_ALTER === 'true' && dialect !== 'sqlite');
  await sequelize.sync({ ...options, alter: useAlter });
  return sequelize;
};

const runMigrations = async () => {
  const umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, '..', 'migrations', '*.js'),
      resolve: ({ name, path: migPath, context }) => {
        const migration = require(migPath);
        return {
          name,
          up: async () => migration.up({ context }),
          down: async () => migration.down({ context })
        };
      }
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console
  });
  await umzug.up();
  return sequelize;
};

module.exports = {
  sequelize,
  models,
  syncDatabase,
  runMigrations,
  testConnection,
  User,
  VM,
  Invoice,
  InvoiceItem,
  ScalingPolicy,
  ScalingEvent,
  ResourceUsage,
  PricingRule,
  VmRuntime,
  VMTemplate,
  GlobalScaleUpRule,
  PaymentMethod,
  UsageSlice,
  Notification
};
