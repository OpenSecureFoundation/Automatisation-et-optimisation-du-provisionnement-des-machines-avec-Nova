const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VMTemplate = sequelize.define('VMTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  flavorId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'flavor_id'
  },
  imageId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'image_id'
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
  tableName: 'vm_templates',
  underscored: true,
  timestamps: true
});

module.exports = VMTemplate;
