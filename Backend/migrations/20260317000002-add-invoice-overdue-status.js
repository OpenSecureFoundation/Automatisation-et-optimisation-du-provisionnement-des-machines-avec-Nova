'use strict';

module.exports = {
  async up({ context: queryInterface }) {
    const dialect = queryInterface.sequelize.getDialect();
    // SQLite stores enums as text; nothing to alter at schema level.
    if (dialect === 'sqlite') return;

    // Postgres enum type for invoices.status is usually "enum_invoices_status".
    // Add value if missing; safe no-op when already present.
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'enum_invoices_status'
            AND e.enumlabel = 'overdue'
        ) THEN
          ALTER TYPE "enum_invoices_status" ADD VALUE 'overdue';
        END IF;
      END$$;
    `);
  },

  async down() {
    // Postgres enum value removal is not trivial without type recreation.
    // Keep as no-op for safe rollback.
  }
};
