'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    const tableInfo = await queryInterface.describeTable('vms');
    if (tableInfo.expires_at) return;
    await queryInterface.addColumn('vms', 'expires_at', {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('vms', 'expires_at');
  }
};
