const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UsageSlice = sequelize.define('UsageSlice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
    field: 'user_id'
  },
  instanceId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'instance_id'
  },
  sliceStart: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'slice_start'
  },
  sliceEnd: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'slice_end'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 0,
    field: 'amount'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'XAF'
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'invoices', key: 'id' },
    onDelete: 'SET NULL',
    field: 'invoice_id'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'usage_slices',
  underscored: true,
  timestamps: false
});

module.exports = UsageSlice;
