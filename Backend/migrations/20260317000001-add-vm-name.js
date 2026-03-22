'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    const tableInfo = await queryInterface.describeTable('vms');
    if (tableInfo.name) return;
    await queryInterface.addColumn('vms', 'name', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
  },

  async down({ context: queryInterface }) {
    const tableInfo = await queryInterface.describeTable('vms').catch(() => ({}));
    if (!tableInfo.name) return;
    await queryInterface.removeColumn('vms', 'name');
  }
};
