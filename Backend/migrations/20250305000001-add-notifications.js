'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up({ context: queryInterface }) {
    const tables = await queryInterface.showAllTables();
    const dialect = queryInterface.sequelize.getDialect();
    const isSqlite = dialect === 'sqlite';
    const has = (name) => tables.some((t) => (isSqlite ? t === name : t.toLowerCase() === name.toLowerCase()));
    if (has('notifications')) return;

    await queryInterface.createTable('notifications', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'info' },
      title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
      message: { type: DataTypes.TEXT, allowNull: true },
      link: { type: DataTypes.STRING(512), allowNull: true },
      read_at: { type: DataTypes.DATE, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false }
    });
  },

  async down({ context: queryInterface }) {
    await queryInterface.dropTable('notifications');
  }
};
