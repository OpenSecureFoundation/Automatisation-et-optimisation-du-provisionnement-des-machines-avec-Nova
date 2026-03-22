'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.is_active) return;
    await queryInterface.addColumn('users', 'is_active', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('users', 'is_active');
  }
};
