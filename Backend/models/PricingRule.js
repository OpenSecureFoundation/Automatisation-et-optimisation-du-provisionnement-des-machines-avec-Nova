const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PricingRule = sequelize.define('PricingRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  resourceType: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: 'cpu, ram, storage, etc.',
    field: 'resource_type'
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    field: 'unit_price'
  },
  unit: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'hour',
    comment: 'hour, month, gb_hour, etc.'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'XAF'
  },
  effectiveDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'effective_date'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'pricing_rules',
  underscored: true,
  timestamps: true
});

module.exports = PricingRule;
