const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VmRuntime = sequelize.define('VmRuntime', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  instanceId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'instance_id'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
    onDelete: 'CASCADE',
    field: 'user_id'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'started_at'
  },
  stoppedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'stopped_at'
  }
}, {
  tableName: 'vm_runtimes',
  underscored: true,
  timestamps: false
});

module.exports = VmRuntime;
