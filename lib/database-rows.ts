/**
 * Checks every query result before it becomes a domain type. A schema change, a bad backfill or an
 * older JSONB shape then fails clearly instead of reaching pages and emails as undefined fields.
 * Each area keeps its row parsers next to its queries (lib/catalog/rows.ts, lib/alerts/rows.ts);
 * they normalise older but legitimate shapes rather than reject them.
 */

export type Row = Record<string, unknown>;

const PUBLICATION_ID = /^MLA\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Names the table and the first invalid field, never a value: rows hold emails and listing content. */
export class InvalidRowError extends Error {
  constructor(readonly table: string, readonly field: string) {
    super(`Invalid ${table} row: ${field}`);
    this.name = 'InvalidRowError';
  }
}

/** Thrown by the readers below. parseRow and parseRows add the table and the row's ID. */
class InvalidField extends Error {
  constructor(readonly field: string) { super(field); }
}

function invalid(field: string): never {
  throw new InvalidField(field);
}

/** Only the row's own ID is logged, and only when it has the expected shape. */
function rowKey(row: Row | undefined) {
  if (typeof row?.publication_id === 'string' && PUBLICATION_ID.test(row.publication_id)) return { publicationId: row.publication_id };
  if (typeof row?.id === 'string' && UUID.test(row.id)) return { id: row.id };
  return {};
}

function report(table: string, row: Row | undefined, error: unknown, action: 'failed' | 'skipped') {
  if (!(error instanceof InvalidField)) throw error;
  console.error(JSON.stringify({ event: 'invalid_database_row', action, table, field: error.field, ...rowKey(row) }));
  return new InvalidRowError(table, error.field);
}

/** Single-item reads and job or lease bookkeeping: a missing or invalid row fails the operation. */
export function parseRow<T>(table: string, row: Row | undefined, parse: (row: Row) => T): T {
  try { return parse(row ?? invalid('row')); }
  catch (error) { throw report(table, row, error, 'failed'); }
}

/** List reads: an invalid row is logged and left out, so one bad row cannot fail a page or a cron. */
export function parseRows<T>(table: string, rows: Row[], parse: (row: Row) => T): T[] {
  return rows.flatMap(row => {
    try { return [parse(row)]; }
    catch (error) { report(table, row, error, 'skipped'); return []; }
  });
}

export function text(value: unknown, field: string) {
  return typeof value === 'string' ? value : invalid(field);
}

export function optionalText(value: unknown, field: string) {
  return value === null ? null : text(value, field);
}

export function oneOf<T extends string>(values: readonly T[], value: unknown, field: string): T {
  return values.includes(value as T) ? value as T : invalid(field);
}

export function uuid(value: unknown, field: string) {
  return typeof value === 'string' && UUID.test(value) ? value : invalid(field);
}

export function publicationId(value: unknown, field: string) {
  return typeof value === 'string' && PUBLICATION_ID.test(value) ? value : invalid(field);
}

export function boolean(value: unknown, field: string) {
  return typeof value === 'boolean' ? value : invalid(field);
}

/** A JSON number. */
export function number(value: unknown, field: string) {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalid(field);
}

/** integer columns arrive as numbers, bigint ones as strings. */
export function integer(value: unknown, field: string) {
  const parsed = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === 'number' && Number.isSafeInteger(parsed) ? parsed : invalid(field);
}

export function optionalInteger(value: unknown, field: string) {
  return value === null ? null : integer(value, field);
}

/** numeric columns arrive as strings. */
export function decimal(value: unknown, field: string) {
  const parsed = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : invalid(field);
}

/** timestamptz columns arrive as Dates from both the Neon driver and PGlite. */
export function timestamp(value: unknown, field: string) {
  const time = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time) : invalid(field);
}

export function optionalTimestamp(value: unknown, field: string) {
  return value === null ? null : timestamp(value, field);
}

/** A JSON object (jsonb). */
export function record(value: unknown, field: string): Row {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : invalid(field);
}

export function list(value: unknown, field: string): unknown[] {
  return Array.isArray(value) ? value : invalid(field);
}

export function textList(value: unknown, field: string) {
  return list(value, field).map(entry => text(entry, field));
}

/** A leased row of a per-publication queue: catalog_sync_jobs or price_alert_item_jobs. */
export function parseJobLease(row: Row) {
  return {
    publication_id: publicationId(row.publication_id, 'publication_id'),
    revision: integer(row.revision, 'revision'),
    attempts: integer(row.attempts, 'attempts'),
  };
}
