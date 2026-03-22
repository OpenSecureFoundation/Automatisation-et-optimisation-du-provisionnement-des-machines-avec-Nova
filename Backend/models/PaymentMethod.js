const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentMethod = sequelize.define('PaymentMethod', {
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
  cardNumber: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Fictif TEST uniquement - en production ne pas stocker',
    field: 'card_number'
  },
  cardExpiry: {
    type: DataTypes.STRING(8),
    allowNull: true,
    field: 'card_expiry'
  },
  cardCvv: {
    type: DataTypes.STRING(8),
    allowNull: true,
    field: 'card_cvv'
  },
  last4: {
    type: DataTypes.STRING(4),
    allowNull: true,
    field: 'last4'
  },
  brand: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'brand'
  },
  isTest: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_test'
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
  tableName: 'payment_methods',
  underscored: true,
  timestamps: true
});

module.exports = PaymentMethod;
