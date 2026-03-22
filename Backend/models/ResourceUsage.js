const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ResourceUsage = sequelize.define('ResourceUsage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vmId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'vms', key: 'id' },
    onDelete: 'CASCADE',
    field: 'vm_id'
  },
  metricType: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'metric_type'
  },
  value: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'resource_usages',
  underscored: true,
  timestamps: true,
  updatedAt: false
});

module.exports = ResourceUsage;
