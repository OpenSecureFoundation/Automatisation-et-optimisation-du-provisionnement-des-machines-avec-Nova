const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
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
  invoiceNumber: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    field: 'invoice_number'
  },
  periodStart: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'period_start'
  },
  periodEnd: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'period_end'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'total_amount'
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'XAF'
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'paid', 'overdue', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  generatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'generated_at'
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
  tableName: 'invoices',
  underscored: true,
  timestamps: true
});

module.exports = Invoice;
