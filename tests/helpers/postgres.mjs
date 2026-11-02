import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migrationsDirectory = new URL('../../database/migrations/', import.meta.url);

// Every migration, in the order the runner applies them.
export const ALL_MIGRATIONS = readdirSync(migrationsDirectory).filter(file => file.endsWith('.sql')).sort();

export function readMigration(file) {
  return readFileSync(new URL(file, migrationsDirectory), 'utf8');
}

// Applies each migration twice: the runner expects rerunnable DDL.
export async function applyMigrationsTwice(db, files = ALL_MIGRATIONS) {
  const migrations = files.map(readMigration);
  for (let i = 0; i < 2; i++) for (const migration of migrations) await db.exec(migration);
}

// Real PostgreSQL in memory (PGlite) with the given migrations applied twice.
export async function createDatabase(files = ALL_MIGRATIONS) {
  const db = new PGlite();
  await applyMigrationsTwice(db, files);
  return db;
}

// Stands in for the Neon driver: a tagged template becomes a parameterized query that runs when
// awaited, or inside sql.transaction([...]). `faults.query` and `faults.commit` simulate outages.
export function createSql(getDb, faults = {}) {
  function sql(strings, ...values) {
    const text = strings.reduce((result, part, i) => result + part + (i < values.length ? `$${i + 1}` : ''), '');
    return {
      text, values,
      then(onFulfilled, onRejected) {
        const rows = faults.query
          ? Promise.reject(Error('Simulated database outage'))
          : getDb().query(text, values).then(result => result.rows);
        return rows.then(onFulfilled, onRejected);
      },
    };
  }
  sql.transaction = async queries => {
    if (faults.commit) throw Error('Simulated DB failure after provider acceptance');
    return getDb().transaction(async tx => {
      const results = [];
      for (const query of queries) results.push((await tx.query(query.text, query.values)).rows);
      return results;
    });
  };
  return sql;
}
