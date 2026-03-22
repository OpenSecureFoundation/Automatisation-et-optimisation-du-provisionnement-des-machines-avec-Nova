const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  role: {
    type: DataTypes.ENUM('admin', 'client'),
    allowNull: false,
    defaultValue: 'client'
  },
  paymentMode: {
    type: DataTypes.ENUM('manual', 'auto'),
    allowNull: false,
    defaultValue: 'manual',
    field: 'payment_mode'
  },
  openstackProjectId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'Keystone project ID for multi-tenant isolation when KEYSTONE_MULTI_TENANT=true',
    field: 'openstack_project_id'
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
  tableName: 'users',
  underscored: true,
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.changed('passwordHash') && user.passwordHash && !user.passwordHash.startsWith('$2')) {
        user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
      }
    }
  }
});

User.prototype.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

module.exports = User;
