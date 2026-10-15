// Shared setup for the API integration tests. Points the app at the
// `<database>_test` database (created by `npm run db:setup`), migrates it and
// gives every test file a clean slate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envFile = path.join(here, '..', '.env');
  const env = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const url = new URL(process.env.DATABASE_URL || env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/^\//, '')}_test`;
  return url.toString();
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.SERVE_FRONTEND = 'false';
// Tests are offline and deterministic: local Whisper and the rule engine,
// whatever backend/.env selects. TEST_USE_PROVIDERS=1 uses the real ones.
if (!process.env.TEST_USE_PROVIDERS) {
  process.env.ASR_PROVIDER = 'local';
  process.env.LLM_PROVIDER = 'none';
}

const { app } = await import('../app/main.js');
const { sequelize } = await import('../app/db/session.js');
const { createMigrator } = await import('../app/db/migrator.js');
const supertest = (await import('supertest')).default;

export { app, sequelize };
export const api = () => supertest(app);

export async function resetDatabase() {
  const quiet = { info() {}, warn() {}, error: console.error, debug() {} };
  await createMigrator({ logger: quiet }).up();
  const [rows] = await sequelize.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  );
  if (rows.length) {
    await sequelize.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

let counter = 0;
export async function registerUser(overrides = {}) {
  counter += 1;
  const body = {
    email: `user${counter}-${Date.now()}@example.com`,
    password: 'Secret123',
    first_name: 'Test',
    last_name: `User${counter}`,
    timezone: 'Asia/Kolkata',
    ...overrides,
  };
  const res = await api().post('/api/v1/auth/register').send(body).expect(201);
  return { ...res.body, password: body.password, auth: { Authorization: `Bearer ${res.body.access_token}` } };
}

export const fixture = (name) => fs.readFileSync(path.join(here, 'fixtures', name));
