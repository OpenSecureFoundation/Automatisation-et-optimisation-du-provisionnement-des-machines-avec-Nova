const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VM = sequelize.define('VM', {
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
    comment: 'OpenStack server UUID',
    field: 'instance_id'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'OpenStack server display name'
  },
  flavorId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'flavor_id'
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: 'UNKNOWN'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When set, VM is considered rented until this time; cleanup job may delete after',
    field: 'expires_at'
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
  tableName: 'vms',
  underscored: true,
  timestamps: true
});

module.exports = VM;
