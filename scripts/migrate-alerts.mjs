import { existsSync } from 'node:fs';
import { Client } from '@neondatabase/serverless';
import { migrate } from './migration-runner.mjs';

// npm run db:migrate                  apply pending migrations
// npm run db:migrate -- --status      list what would be applied, change nothing
// npm run db:migrate -- --baseline    once per existing database: record the migrations it already has
// See docs/neon-alert-storage.md, "Migrations".
const args = process.argv.slice(2);
const unknown = args.filter(arg => !['--status', '--baseline'].includes(arg));
if (unknown.length > 0) throw Error(`Unknown option ${unknown.join(' ')}. Use --status or --baseline.`);

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
if (!process.env.DATABASE_URL) throw new Error('Set the server-only DATABASE_URL before migrating.');
// Use the same branch credentials with a direct endpoint for schema work.
const migrationUrl = new URL(process.env.DATABASE_URL);
migrationUrl.hostname = migrationUrl.hostname.replace('-pooler.', '.');
// A WebSocket session, not the HTTP `neon()` driver: HTTP queries are single prepared statements,
// while a migration file is several statements run as one batch inside an explicit transaction.
// Node 22 provides the global WebSocket the driver uses.
const client = new Client(migrationUrl.toString());
client.on('error', error => console.error('Database connection error:', error.message));
await client.connect();
try {
  console.log(`Database: ${migrationUrl.hostname}${migrationUrl.pathname}`);
  const session = { exec: text => client.query(text), query: async (text, params) => (await client.query(text, params)).rows };
  const status = args.includes('--status');
  const { applied, skipped, baselined } = await migrate(session, undefined,
    { baseline: args.includes('--baseline'), dryRun: status, log: message => console.log(message) });
  if (baselined.length > 0) {
    console.log(`${status ? 'Would record' : 'Recorded'} a baseline of ${baselined.length} migration(s). Then run npm run db:migrate.`);
  } else if (status) {
    console.log(`Status only, nothing was changed: ${applied.length} pending, ${skipped.length} already applied.`);
  } else {
    console.log(`Applied ${applied.length} migration(s); ${skipped.length} already applied.`);
  }
} finally {
  await client.end();
}
