const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'invoices', key: 'id' },
    onDelete: 'CASCADE',
    field: 'invoice_id'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    defaultValue: 1
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'unit_price'
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total'
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
  tableName: 'invoice_items',
  underscored: true,
  timestamps: true
});

module.exports = InvoiceItem;
