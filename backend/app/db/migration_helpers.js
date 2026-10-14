// File: app/db/migration_helpers.js
// Column builders shared by the files in /migrations so every table gets the
// same primary-key and timestamp conventions.

export const uuidPk = (Sequelize) => ({
  type: Sequelize.UUID,
  primaryKey: true,
  allowNull: false,
  defaultValue: Sequelize.literal('gen_random_uuid()'),
});

export const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
  updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
});

export const createdAt = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
});

// Foreign key to another table's `id` column.
export const fk = (Sequelize, table, { allowNull = false, onDelete = 'CASCADE', column = 'id' } = {}) => ({
  type: Sequelize.UUID,
  allowNull,
  references: { model: table, key: column },
  onUpdate: 'CASCADE',
  onDelete,
});

// CHECK (column IN (...)) constraint, named <table>_<column>_check.
export function checkIn(queryInterface, table, column, values) {
  const list = values.map((v) => `'${v}'`).join(', ');
  return queryInterface.sequelize.query(
    `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_check" CHECK ("${column}" IN (${list}))`,
  );
}
