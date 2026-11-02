import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, describe, it } from 'vitest';
import { BASELINE, migrate, pgliteSession, readMigrations } from '../../scripts/migration-runner.mjs';

// The migration runner behind `npm run db:migrate`, against real PostgreSQL (PGlite).
const migrations = readMigrations();
const files = migrations.map(({ file }) => file);
const history = async db => (await db.query('SELECT filename, checksum, baseline FROM public.schema_migrations ORDER BY filename')).rows;
const constraintValid = async db => (await db.query(`SELECT convalidated FROM pg_constraint
  WHERE conname = 'catalog_publications_vehicle_category_check'`)).rows[0]?.convalidated;
// Synthetic migrations live in a temporary directory, read by the same discovery code.
function directory(contents) {
  const path = mkdtempSync(join(tmpdir(), 'migrations-'));
  for (const [file, sql] of Object.entries(contents)) writeFileSync(join(path, file), sql);
  return { url: pathToFileURL(path + '/'), remove: () => rmSync(path, { recursive: true }) };
}
// Existing databases, migrated by the earlier runner without a history (every known file, run whole).
async function legacyDatabase(count) {
  const legacy = new PGlite();
  for (const { sql } of migrations.slice(0, count)) await legacy.exec(sql);
  return legacy;
}

describe('migration discovery', () => {
  // Every .sql file in database/migrations/, sorted, including the frozen baseline.
  it('reads every migration in order, with the baseline first', () => {
    assert.deepEqual(files, [...files].sort());
    assert.deepEqual(BASELINE.map(({ file }) => file), files.slice(0, BASELINE.length), 'The baseline is the first migrations, in order');
    assert.ok(migrations.every(({ checksum }) => /^[0-9a-f]{64}$/.test(checksum)));
  });

  it('rejects a badly named migration', () => {
    const badName = directory({ '2099_bad name.sql': 'SELECT 1' });
    try {
      assert.throws(() => readMigrations(badName.url), /must be named YYYYMMDD_description\.sql/);
    } finally {
      badName.remove();
    }
  });
});

// Each step continues on the database the previous one migrated.
describe('an empty database', () => {
  const db = new PGlite();
  afterAll(() => db.close());

  it('applies every migration once and records its checksum', async () => {
    const result = await migrate(pgliteSession(db));
    assert.deepEqual(result.applied, files);
    assert.deepEqual(await history(db), migrations.map(({ file, checksum }) => ({ filename: file, checksum, baseline: false })));
  });

  it('skips applied migrations on the next run', async () => {
    await db.exec('ALTER TABLE public.catalog_publications VALIDATE CONSTRAINT catalog_publications_vehicle_category_check');
    const result = await migrate(pgliteSession(db));
    assert.deepEqual([result.applied, result.skipped], [[], files], 'Applied migrations are skipped');
    assert.equal(await constraintValid(db), true, 'Skipping 20261102 keeps a validated constraint validated');
    // What the earlier runner did on every run: re-executing 20261102 makes the constraint NOT VALID again.
    await db.exec(migrations.find(({ file }) => file === '20261102_catalog_vehicle_category.sql').sql);
    assert.equal(await constraintValid(db), false, 'Rerunning the file demotes the constraint (the bug the history prevents)');
  });

  // An applied file that changed, or disappeared, stops the run before anything is applied.
  it('stops when an applied migration changed or disappeared', async () => {
    const edited = migrations.map(migration => migration.file === files[0] ? { ...migration, checksum: '0'.repeat(64) } : migration);
    await assert.rejects(migrate(pgliteSession(db), edited), /20261028_alert_subscriptions\.sql changed after it was applied/);
    await assert.rejects(migrate(pgliteSession(db), migrations.slice(1)), /20261028_alert_subscriptions\.sql is recorded as applied but no longer exists/);
  });

  // A new migration dated before the latest applied one would run in an untested order.
  it('refuses a new migration dated before the latest applied one', async () => {
    const late = { file: '20261029_late.sql', sql: 'SELECT 1', checksum: 'x' };
    await assert.rejects(migrate(pgliteSession(db), [...migrations, late].sort((a, b) => a.file.localeCompare(b.file))),
      /20261029_late\.sql sorts before the already applied/);
  });

  it('reports pending migrations in a status run without applying them', async () => {
    const next = { file: '29991231_next.sql', sql: 'CREATE TABLE public.next_table (id int)', checksum: 'y' };
    const result = await migrate(pgliteSession(db), [...migrations, next], { dryRun: true });
    assert.deepEqual(result.applied, ['29991231_next.sql']);
    assert.equal((await db.query("SELECT to_regclass('public.next_table') AS t")).rows[0].t, null, 'A status run applies nothing');
  });
});

// Whole files, no statement splitting: semicolons in comments, strings and function bodies are SQL.
describe('whole-file migrations', () => {
  it('keep embedded semicolons and roll back a failed file entirely', async () => {
    const synthetic = directory({
      '20990101_semicolons.sql': `-- A comment; with a semicolon.
        CREATE TABLE public.notes (body text NOT NULL DEFAULT 'a;b');
        /* Block comment; still a comment. */
        CREATE FUNCTION public.note_count() RETURNS bigint LANGUAGE plpgsql AS $$
        BEGIN
          RETURN (SELECT count(*) FROM public.notes);
        END;
        $$;
        INSERT INTO public.notes DEFAULT VALUES;`,
      // Fails halfway: the whole file, including its first statement, is rolled back and not recorded.
      '20990102_broken.sql': 'CREATE TABLE public.half_done (id int); SELECT 1 / 0;',
      'README.txt': 'Only .sql files are migrations.',
    });
    const db = new PGlite();
    try {
      await assert.rejects(migrate(pgliteSession(db), readMigrations(synthetic.url)), /20990102_broken\.sql failed and was rolled back: division by zero/);
      assert.deepEqual((await db.query('SELECT body, public.note_count() AS count FROM public.notes')).rows, [{ body: 'a;b', count: 1 }]);
      assert.equal((await db.query("SELECT to_regclass('public.half_done') AS t")).rows[0].t, null, 'A failed migration leaves nothing behind');
      assert.deepEqual((await history(db)).map(({ filename }) => filename), ['20990101_semicolons.sql'], 'Earlier migrations stay applied');
    } finally {
      synthetic.remove();
      await db.close();
    }
  });
});

describe('baselining an existing database', () => {
  it('adopts a fully migrated database once, then applies only newer migrations', async () => {
    const db = await legacyDatabase(BASELINE.length);
    try {
      await db.exec('ALTER TABLE public.catalog_publications VALIDATE CONSTRAINT catalog_publications_vehicle_category_check');
      await assert.rejects(migrate(pgliteSession(db)), /already has tables .* but no migration history.*--baseline/, 'A plain run refuses to rerun everything');
      assert.deepEqual(await history(db), [], 'The refused run records nothing');
      let result = await migrate(pgliteSession(db), undefined, { baseline: true, dryRun: true });
      assert.deepEqual([result.baselined, await history(db)], [BASELINE.map(({ file }) => file), []], 'A baseline status run records nothing');
      result = await migrate(pgliteSession(db), undefined, { baseline: true });
      assert.deepEqual(result.baselined, BASELINE.map(({ file }) => file));
      assert.ok((await history(db)).every(({ baseline }) => baseline), 'Adopted migrations are marked as baseline');
      assert.equal(await constraintValid(db), true, 'The baseline runs no migration');
      result = await migrate(pgliteSession(db));
      assert.deepEqual(result.applied, files.slice(BASELINE.length), 'Only migrations newer than the baseline run');
      assert.equal(await constraintValid(db), true);
      await assert.rejects(migrate(pgliteSession(db), undefined, { baseline: true }), /already has a migration history/);
    } finally {
      await db.close();
    }
  });

  // A database last migrated when fewer files existed adopts what it has; the next run applies the rest.
  it('adopts a database migrated when fewer files existed, keeping its rows', async () => {
    const db = await legacyDatabase(3);
    try {
      await db.exec("INSERT INTO public.vehicle_price_alerts (email, vehicle_slug, current_price, currency) VALUES ('legacy@example.invalid', 'a-mla1', 1, 'USD')");
      assert.deepEqual((await migrate(pgliteSession(db), undefined, { baseline: true })).baselined, files.slice(0, 3));
      assert.deepEqual((await migrate(pgliteSession(db))).applied, files.slice(3));
      assert.equal((await db.query('SELECT count(*)::int AS count FROM public.vehicle_price_alerts')).rows[0].count, 1, 'Existing rows are kept');
    } finally {
      await db.close();
    }
  });

  // Missing objects in the middle of the baseline mean a hand-edited schema: adopt nothing.
  it('adopts nothing from a hand-edited schema', async () => {
    const db = await legacyDatabase(BASELINE.length);
    try {
      await db.exec('ALTER TABLE public.vehicle_price_alerts DROP COLUMN confirmed_at');
      await assert.rejects(migrate(pgliteSession(db), undefined, { baseline: true }), /20261030_alert_signup_confirmation\.sql is missing but later migrations are present/);
    } finally {
      await db.close();
    }
  });

  it('refuses to baseline an empty database', async () => {
    const db = new PGlite();
    try {
      await assert.rejects(migrate(pgliteSession(db), undefined, { baseline: true }), /None of the baseline migrations are present/);
    } finally {
      await db.close();
    }
  });
});
