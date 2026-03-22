'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(params) {
    // Umzug v3 passes { context, name, path }; older or other setups may pass context directly
    const queryInterface = params?.context ?? params;
    if (!queryInterface?.sequelize) {
      throw new Error('Migration up: missing queryInterface (context)');
    }
    const dialect = queryInterface.sequelize.getDialect();
    const isSqlite = dialect === 'sqlite';
    let tables = await queryInterface.showAllTables();
    if (!Array.isArray(tables)) {
      tables = [];
    }
    // Normalize: strip schema prefix (e.g. "public.users" -> "users") for comparison
    const normalize = (t) => (typeof t === 'string' ? t.split('.').pop() : String(t));
    const has = (name) => tables.some((t) => (isSqlite ? normalize(t) === name : normalize(t).toLowerCase() === name.toLowerCase()));

    if (!has('users')) {
      await queryInterface.createTable('users', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        password_hash: { type: DataTypes.STRING(255), allowNull: false },
        name: { type: DataTypes.STRING(120), allowNull: true },
        role: { type: isSqlite ? DataTypes.STRING(32) : DataTypes.ENUM('admin', 'client'), allowNull: false, defaultValue: 'client' },
        payment_mode: { type: isSqlite ? DataTypes.STRING(32) : DataTypes.ENUM('manual', 'auto'), allowNull: false, defaultValue: 'manual' },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('vms')) {
      await queryInterface.createTable('vms', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        instance_id: { type: DataTypes.STRING(64), allowNull: false },
        flavor_id: { type: DataTypes.STRING(64), allowNull: true },
        status: { type: DataTypes.STRING(32), allowNull: true, defaultValue: 'UNKNOWN' },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('invoices')) {
      await queryInterface.createTable('invoices', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        invoice_number: { type: DataTypes.STRING(32), allowNull: false, unique: true },
        period_start: { type: DataTypes.DATE, allowNull: false },
        period_end: { type: DataTypes.DATE, allowNull: false },
        total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'XAF' },
        status: { type: isSqlite ? DataTypes.STRING(32) : DataTypes.ENUM('draft', 'pending', 'paid', 'cancelled'), allowNull: false, defaultValue: 'pending' },
        generated_at: { type: DataTypes.DATE, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('invoice_items')) {
      await queryInterface.createTable('invoice_items', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        invoice_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'invoices', key: 'id' }, onDelete: 'CASCADE' },
        description: { type: DataTypes.STRING(255), allowNull: false },
        quantity: { type: DataTypes.DECIMAL(12, 4), allowNull: false, defaultValue: 1 },
        unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('scaling_policies')) {
      await queryInterface.createTable('scaling_policies', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        instance_id: { type: DataTypes.STRING(64), allowNull: false },
        metric_type: { type: DataTypes.STRING(32), allowNull: false },
        threshold_high: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        threshold_low: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
        action_type: { type: DataTypes.STRING(32), allowNull: true, defaultValue: 'resize' },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        cooldown_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
        base_flavor_id: { type: DataTypes.STRING(64), allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('scaling_events')) {
      await queryInterface.createTable('scaling_events', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        instance_id: { type: DataTypes.STRING(64), allowNull: false },
        action: { type: DataTypes.STRING(16), allowNull: false },
        old_flavor_id: { type: DataTypes.STRING(64), allowNull: true },
        new_flavor_id: { type: DataTypes.STRING(64), allowNull: true },
        trigger_metric: { type: DataTypes.STRING(32), allowNull: true },
        trigger_value: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        timestamp: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('resource_usages')) {
      await queryInterface.createTable('resource_usages', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        vm_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'vms', key: 'id' }, onDelete: 'CASCADE' },
        metric_type: { type: DataTypes.STRING(32), allowNull: false },
        value: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
        timestamp: { type: DataTypes.DATE, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('pricing_rules')) {
      await queryInterface.createTable('pricing_rules', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        resource_type: { type: DataTypes.STRING(32), allowNull: false },
        unit_price: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
        unit: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'hour' },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'XAF' },
        effective_date: { type: DataTypes.DATEONLY, allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('vm_runtimes')) {
      await queryInterface.createTable('vm_runtimes', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        instance_id: { type: DataTypes.STRING(64), allowNull: false },
        user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        started_at: { type: DataTypes.DATE, allowNull: false },
        stopped_at: { type: DataTypes.DATE, allowNull: true }
      });
    }

    if (!has('vm_templates')) {
      await queryInterface.createTable('vm_templates', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        name: { type: DataTypes.STRING(120), allowNull: false },
        description: { type: DataTypes.STRING(255), allowNull: true },
        flavor_id: { type: DataTypes.STRING(64), allowNull: false },
        image_id: { type: DataTypes.STRING(64), allowNull: false },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('global_scale_up_rules')) {
      await queryInterface.createTable('global_scale_up_rules', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        delta_vcpus: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
        delta_ram_mb: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4096 },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('payment_methods')) {
      await queryInterface.createTable('payment_methods', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        card_number: { type: DataTypes.STRING(64), allowNull: true },
        card_expiry: { type: DataTypes.STRING(8), allowNull: true },
        card_cvv: { type: DataTypes.STRING(8), allowNull: true },
        last4: { type: DataTypes.STRING(4), allowNull: true },
        brand: { type: DataTypes.STRING(32), allowNull: true },
        is_test: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }

    if (!has('usage_slices')) {
      await queryInterface.createTable('usage_slices', {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        user_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        instance_id: { type: DataTypes.STRING(64), allowNull: false },
        slice_start: { type: DataTypes.DATE, allowNull: false },
        slice_end: { type: DataTypes.DATE, allowNull: false },
        amount: { type: DataTypes.DECIMAL(12, 4), allowNull: false, defaultValue: 0 },
        currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'XAF' },
        invoice_id: { type: DataTypes.UUID, allowNull: true, references: { model: 'invoices', key: 'id' }, onDelete: 'SET NULL' },
        created_at: { type: DataTypes.DATE, allowNull: false }
      });
    }
  },

  async down(params) {
    const queryInterface = params?.context ?? params;
    if (!queryInterface?.sequelize) {
      throw new Error('Migration down: missing queryInterface (context)');
    }
    const tables = ['usage_slices', 'payment_methods', 'global_scale_up_rules', 'vm_templates', 'vm_runtimes', 'pricing_rules', 'resource_usages', 'scaling_events', 'scaling_policies', 'invoice_items', 'invoices', 'vms', 'users'];
    for (const table of tables) {
      await queryInterface.dropTable(table, { cascade: true });
    }
  }
};
