import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// The one migration runner: `npm run db:migrate` (Neon) and every PGlite test call it, so what the
// tests apply is what production applies. See docs/neon-alert-storage.md, "Migrations".
//
// `db` is a small adapter over one database session:
//   exec(text)          runs a whole file as one batch (simple query protocol, several statements)
//   query(text, params) runs one parameterised statement and resolves to its rows
// Each migration runs whole inside its own transaction, together with its schema_migrations row.

export const MIGRATIONS_DIRECTORY = new URL('../database/migrations/', import.meta.url);

// The migrations already applied to existing databases by the earlier runner, before
// schema_migrations existed. `--baseline` records them without running them again, after checking
// that the objects each one creates are present. Frozen: new migrations never go here.
export const BASELINE = [
  { file: '20261028_alert_subscriptions.sql', tables: ['vehicle_price_alerts', 'vehicle_inventory_alerts'] },
  {
    file: '20261029_price_alert_delivery.sql',
    tables: ['price_alert_item_jobs', 'price_alert_deliveries', 'price_alert_signup_windows'],
    columns: [['vehicle_price_alerts', 'publication_id']],
  },
  {
    file: '20261030_alert_signup_confirmation.sql',
    columns: [
      ['vehicle_price_alerts', 'confirmed_at'],
      ['vehicle_inventory_alerts', 'confirmed_at'],
      ['vehicle_inventory_alerts', 'generation'],
    ],
  },
  {
    file: '20261031_catalog_sync.sql',
    tables: ['catalog_publications', 'catalog_price_history', 'catalog_sync_jobs', 'catalog_sync_runs'],
  },
  {
    file: '20261101_inventory_alert_delivery.sql',
    tables: ['inventory_alert_events', 'inventory_alert_deliveries', 'inventory_alert_matches'],
  },
  {
    file: '20261102_catalog_vehicle_category.sql',
    columns: [['catalog_publications', 'vehicle_category']],
    constraints: ['catalog_publications_vehicle_category_check'],
  },
];

const FILE_NAME = /^\d{8}_[a-z0-9_]+\.sql$/;
// Serialises concurrent runs against the same database (session-level advisory lock).
const LOCK_KEY = 4_727_301_205;

/** Every migration file, in the order it is applied (file name order). */
export function readMigrations(directory = MIGRATIONS_DIRECTORY) {
  return readdirSync(directory)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => {
      if (!FILE_NAME.test(file))
        throw Error(`Migration ${file} must be named YYYYMMDD_description.sql (lowercase, underscores).`);
      const sql = readFileSync(new URL(file, directory), 'utf8');
      // Line endings are normalised so a Windows checkout does not look like an edited file.
      return { file, sql, checksum: createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex') };
    });
}

/** Adapter for a PGlite instance (tests). */
export const pgliteSession = db => ({
  exec: text => db.exec(text),
  query: async (text, params) => (await db.query(text, params)).rows,
});

/**
 * Applies pending migrations, or with `baseline: true` adopts an existing schema (see BASELINE).
 * With `dryRun: true` it only reports. Throws, before changing anything, when the recorded history
 * and the files disagree.
 */
export async function migrate(
  db,
  migrations = readMigrations(),
  { baseline = false, dryRun = false, log = () => {} } = {},
) {
  await db.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
  try {
    if (!dryRun)
      await db.exec(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        baseline boolean NOT NULL DEFAULT false,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      REVOKE ALL ON public.schema_migrations FROM PUBLIC;`);
    const recorded = await db.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present");
    const applied = new Map(
      recorded[0].present
        ? (await db.query('SELECT filename, checksum FROM public.schema_migrations')).map(row => [
            row.filename,
            row.checksum,
          ])
        : [],
    );
    const files = new Map(migrations.map(migration => [migration.file, migration]));

    for (const [file, checksum] of applied) {
      if (!files.has(file))
        throw Error(
          `${file} is recorded as applied but no longer exists. Restore it; never rename or delete an applied migration.`,
        );
      if (files.get(file).checksum !== checksum) {
        throw Error(
          `${file} changed after it was applied (checksum mismatch). Restore the applied content and put the change in a new migration.`,
        );
      }
    }
    const pending = migrations.filter(({ file }) => !applied.has(file));
    const latest = [...applied.keys()].sort().at(-1);
    const early = pending.find(({ file }) => latest && file < latest);
    if (early) {
      throw Error(
        `${early.file} sorts before the already applied ${latest}, so it would run in an order the tests never checked. Rename it with a later date.`,
      );
    }

    if (baseline) return await adoptBaseline(db, applied, files, { dryRun, log });

    if (applied.size === 0 && pending.length > 0) {
      const tables =
        await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
        ORDER BY tablename LIMIT 5`);
      if (tables.length > 0) {
        throw Error(
          `This database already has tables (${tables.map(row => row.tablename).join(', ')}) but no migration history. ` +
            'Adopt them once with `npm run db:migrate -- --baseline` (docs/neon-alert-storage.md) instead of running every migration again.',
        );
      }
    }
    for (const migration of pending) {
      log(`${dryRun ? 'Pending' : 'Applying'} ${migration.file}`);
      if (dryRun) continue;
      await db.exec('BEGIN');
      try {
        await db.exec(migration.sql);
        await db.query('INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)', [
          migration.file,
          migration.checksum,
        ]);
        await db.exec('COMMIT');
      } catch (error) {
        await db.exec('ROLLBACK').catch(() => {});
        throw Error(`${migration.file} failed and was rolled back: ${error.message}`, { cause: error });
      }
    }
    return { applied: pending.map(({ file }) => file), skipped: [...applied.keys()].sort(), baselined: [] };
  } finally {
    // A failed unlock must not hide the original error; the lock also ends with the session.
    await db.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
  }
}

async function adoptBaseline(db, applied, files, { dryRun, log }) {
  if (applied.size > 0)
    throw Error('This database already has a migration history; --baseline only adopts a database that has none.');
  // The earlier runner applied every file it knew in one transaction, so a database holds a prefix of
  // BASELINE: the files present at its last run. Anything else means the schema was changed by hand.
  const present = [];
  for (const entry of BASELINE) present.push(await hasObjects(db, entry));
  const count = present.indexOf(false) === -1 ? present.length : present.indexOf(false);
  if (present.slice(count).some(Boolean)) {
    throw Error(
      `Partial schema: ${BASELINE[count].file} is missing but later migrations are present. Inspect the database by hand.`,
    );
  }
  if (count === 0)
    throw Error(
      'None of the baseline migrations are present. On an empty database run `npm run db:migrate` without --baseline.',
    );
  const adopted = BASELINE.slice(0, count).map(({ file }) => {
    if (!files.has(file)) throw Error(`Baseline migration ${file} is missing from database/migrations/.`);
    return files.get(file);
  });
  for (const { file } of adopted)
    log(`${dryRun ? 'Would record' : 'Recording'} ${file} as already applied (baseline, not run)`);
  if (!dryRun) {
    await db.exec('BEGIN');
    try {
      for (const { file, checksum } of adopted) {
        await db.query('INSERT INTO public.schema_migrations (filename, checksum, baseline) VALUES ($1, $2, true)', [
          file,
          checksum,
        ]);
      }
      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK').catch(() => {});
      throw error;
    }
  }
  return { applied: [], skipped: [], baselined: adopted.map(({ file }) => file) };
}

async function hasObjects(db, { tables = [], columns = [], constraints = [] }) {
  const [row] = await db.query(
    `SELECT
      (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[]))::int AS tables,
      (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
        AND table_name || '.' || column_name = ANY($2::text[]))::int AS columns,
      (SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname = ANY($3::text[]))::int AS constraints`,
    [tables, columns.map(pair => pair.join('.')), constraints],
  );
  return row.tables === tables.length && row.columns === columns.length && row.constraints === constraints.length;
}
