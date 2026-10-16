// File: app/db/session.js
// The one Sequelize instance (connection pool) shared by the whole API.
import { Sequelize } from 'sequelize';
import { settings } from '../core/config.js';
import { getLogger } from '../core/logger.js';

const logger = getLogger('db');

export const sequelize = new Sequelize(settings.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.SQL_LOG === 'true' ? (sql) => logger.debug(sql) : false,
  define: {
    // snake_case columns, matching the migrations.
    underscored: true,
    timestamps: true,
    // `underscored` only renames the timestamp *columns*; naming the attributes
    // too makes `row.created_at` work in code (it would otherwise be createdAt).
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  pool: { max: 10, min: 0, idle: 10_000, acquire: 30_000 },
  dialectOptions: settings.DATABASE_SSL ? { ssl: { require: true, rejectUnauthorized: true } } : {},
});

export async function checkConnection() {
  await sequelize.authenticate();
  const [[row]] = await sequelize.query('SELECT version() AS version');
  return row.version;
}

// Run `fn` inside a transaction; commits on success, rolls back on throw.
export function withTransaction(fn) {
  return sequelize.transaction(fn);
}
