import { PGlite } from '@electric-sql/pglite';
import { migrate, pgliteSession, readMigrations } from '../../scripts/migration-runner.mjs';

// Real PostgreSQL in memory (PGlite), migrated by the same runner as `npm run db:migrate`.
export async function createDatabase(migrations = readMigrations()) {
  const db = new PGlite();
  await migrate(pgliteSession(db), migrations);
  return db;
}

// Stands in for the Neon driver: a tagged template becomes a parameterized query that runs when
// awaited, or inside sql.transaction([...]). `faults.query` and `faults.commit` simulate outages.
export function createSql(getDb, faults = {}) {
  function sql(strings, ...values) {
    const text = strings.reduce((result, part, i) => result + part + (i < values.length ? `$${i + 1}` : ''), '');
    return {
      text,
      values,
      then(onFulfilled, onRejected) {
        const rows = faults.query
          ? Promise.reject(Error('Simulated database outage'))
          : getDb()
              .query(text, values)
              .then(result => result.rows);
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
