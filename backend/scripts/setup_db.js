// File: scripts/setup_db.js
// One-time database bootstrap. Connects with an admin account
// (DATABASE_ADMIN_URL) and creates the application role + database named in
// DATABASE_URL, plus a `<name>_test` database for the test suite.
//
//   DATABASE_ADMIN_URL=postgres://postgres:secret@localhost:5432/postgres npm run db:setup
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;
const quoteLiteral = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  const appUrl = process.env.DATABASE_URL;
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!appUrl) throw new Error('DATABASE_URL is not set (backend/.env).');
  if (!adminUrl) throw new Error('Set DATABASE_ADMIN_URL to a superuser connection string to run setup.');

  const target = new URL(appUrl);
  const appUser = decodeURIComponent(target.username);
  const appPassword = decodeURIComponent(target.password);
  const dbName = target.pathname.replace(/^\//, '');
  if (!appUser || !appPassword || !dbName) {
    throw new Error('DATABASE_URL must include a user, password and database name.');
  }

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [appUser]);
    if (role.rowCount === 0) {
      await admin.query(`CREATE ROLE ${quoteIdent(appUser)} LOGIN PASSWORD ${quoteLiteral(appPassword)}`);
      console.log(`Created role ${appUser}`);
    } else {
      await admin.query(`ALTER ROLE ${quoteIdent(appUser)} WITH LOGIN PASSWORD ${quoteLiteral(appPassword)}`);
      console.log(`Role ${appUser} already exists (password refreshed)`);
    }

    for (const name of [dbName, `${dbName}_test`]) {
      const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (db.rowCount === 0) {
        await admin.query(`CREATE DATABASE ${quoteIdent(name)} OWNER ${quoteIdent(appUser)} ENCODING 'UTF8'`);
        console.log(`Created database ${name}`);
      } else {
        console.log(`Database ${name} already exists`);
      }
    }
  } finally {
    await admin.end();
  }
  console.log('Done. Next: npm run migrate && npm run seed');
}

main().catch((err) => {
  console.error(`Database setup failed: ${err.message}`);
  process.exit(1);
});
