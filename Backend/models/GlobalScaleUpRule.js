const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GlobalScaleUpRule = sequelize.define('GlobalScaleUpRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  deltaVcpus: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2,
    field: 'delta_vcpus'
  },
  deltaRamMb: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 4096,
    field: 'delta_ram_mb'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
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
  tableName: 'global_scale_up_rules',
  underscored: true,
  timestamps: true
});

module.exports = GlobalScaleUpRule;
