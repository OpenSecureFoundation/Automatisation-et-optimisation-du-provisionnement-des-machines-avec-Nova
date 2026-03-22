const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScalingEvent = sequelize.define('ScalingEvent', {
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
  action: {
    type: DataTypes.STRING(16),
    allowNull: false,
    comment: 'scale_up | scale_down'
  },
  oldFlavorId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'old_flavor_id'
  },
  newFlavorId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'new_flavor_id'
  },
  triggerMetric: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'trigger_metric'
  },
  triggerValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'trigger_value'
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'scaling_events',
  underscored: true,
  timestamps: false
});

module.exports = ScalingEvent;
