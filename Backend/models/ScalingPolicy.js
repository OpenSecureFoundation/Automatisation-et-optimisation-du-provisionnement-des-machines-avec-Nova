const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScalingPolicy = sequelize.define('ScalingPolicy', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  instanceId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: 'OpenStack server UUID',
    field: 'instance_id'
  },
  metricType: {
    type: DataTypes.STRING(32),
    allowNull: false,
    comment: 'e.g. cpu_util, memory_usage',
    field: 'metric_type'
  },
  thresholdHigh: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: 'Scale up when metric >= this (e.g. 80 for 80%)',
    field: 'threshold_high'
  },
  thresholdLow: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    comment: 'Scale down when metric <= this (e.g. 20 for 20%)',
    field: 'threshold_low'
  },
  actionType: {
    type: DataTypes.STRING(32),
    allowNull: true,
    defaultValue: 'resize',
    field: 'action_type'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  },
  cooldownMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    field: 'cooldown_minutes'
  },
  baseFlavorId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Flavor to revert to on scale down',
    field: 'base_flavor_id'
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
  tableName: 'scaling_policies',
  underscored: true,
  timestamps: true
});

module.exports = ScalingPolicy;
