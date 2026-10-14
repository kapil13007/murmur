// File: scripts/migrate.js
// CLI around the Umzug migrator:
//   node scripts/migrate.js up       apply all pending migrations
//   node scripts/migrate.js down     revert the most recent migration
//   node scripts/migrate.js reset    revert every migration (drops all tables)
//   node scripts/migrate.js status   list applied / pending migrations
import { createMigrator } from '../app/db/migrator.js';
import { sequelize } from '../app/db/session.js';

const quietLogger = { info: () => {}, warn: console.warn, error: console.error, debug: () => {} };

async function main() {
  const command = process.argv[2] || 'up';
  const migrator = createMigrator({ logger: quietLogger });

  if (command === 'up') {
    const applied = await migrator.up();
    if (applied.length === 0) console.log('Database is already up to date.');
    for (const m of applied) console.log(`  applied  ${m.name}`);
  } else if (command === 'down') {
    const reverted = await migrator.down();
    for (const m of reverted) console.log(`  reverted ${m.name}`);
  } else if (command === 'reset') {
    const reverted = await migrator.down({ to: 0 });
    for (const m of reverted) console.log(`  reverted ${m.name}`);
  } else if (command === 'status') {
    const executed = await migrator.executed();
    const pending = await migrator.pending();
    for (const m of executed) console.log(`  [x] ${m.name}`);
    for (const m of pending) console.log(`  [ ] ${m.name}`);
  } else {
    throw new Error(`Unknown command "${command}" (use up | down | reset | status)`);
  }
}

main()
  .catch((err) => {
    console.error(`Migration failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
