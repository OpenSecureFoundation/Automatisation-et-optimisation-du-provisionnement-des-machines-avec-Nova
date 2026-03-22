const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  type: {
    type: DataTypes.STRING(64),
    allowNull: false,
    defaultValue: 'info'
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: ''
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  link: {
    type: DataTypes.STRING(512),
    allowNull: true
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'read_at'
  }
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Notification;
