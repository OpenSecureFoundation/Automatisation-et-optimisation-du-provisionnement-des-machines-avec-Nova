'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    const tableInfo = await queryInterface.describeTable('users');
    if (tableInfo.openstack_project_id) return;
    await queryInterface.addColumn('users', 'openstack_project_id', {
      type: DataTypes.STRING(64),
      allowNull: true
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.removeColumn('users', 'openstack_project_id');
  }
};
