import assert from 'node:assert/strict';
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import * as health from '@/lib/integrations/mercado-libre/health-alerts';
import * as syncRoute from '@/app/api/mercado-libre/sync/route';
import * as dailyRoute from '@/app/api/alerts/daily/route';
import { failure } from '@/lib/integrations/mercado-libre/failures';
import { runtimeImports } from '../helpers/modules.mjs';
import { createDatabase, createSql } from '../helpers/postgres.mjs';

// Owner notifications against real PostgreSQL (PGlite) and the real sync health query. The
// credential record, the sync itself and Resend are fakes.
const state = vi.hoisted(() => ({ sql: null, connection: null, connectionReads: 0, reconcile: null }));
vi.mock('@/lib/database', () => ({ getSql: () => state.sql, isDatabaseConfigured: () => true }));
vi.mock('@/lib/integrations/mercado-libre/credentials', () => ({
  readConnectionDiagnostics: async () => {
    state.connectionReads++;
    if (state.connection instanceof Error) throw state.connection;
    return state.connection;
  },
}));
vi.mock('@/lib/integrations/mercado-libre/inventory-sync', () => ({
  reconcileCatalog: async () => state.reconcile(),
  runCatalogSyncWork: async () => 0,
}));
vi.mock('@/lib/alerts/inventory-delivery', () => ({
  runInventoryAlertWork: async () => {},
  runInventoryAlertWorkSafely: async () => {},
}));
vi.mock('@/lib/alerts/price-delivery', () => ({
  enqueueDailyPriceReview: async () => {},
  runPriceAlertWork: async () => {},
}));

const OWNER = 'owner@example.test';
const HEARTBEAT = 'https://monitor.example.test/ping/secret-id';
const secret = 'DO_NOT_LOG_ACCESS_OR_REFRESH_TOKEN';
const incidentId = '6f1c0d4e-2b8a-4c1e-9f3d-7a5b2c8e1d40';
const connected = {
  state: 'connected',
  providerVerified: false,
  refreshStartedAt: null,
  lockAgeSeconds: null,
  incidentId: null,
  lastFailure: null,
};
const blocked = {
  state: 'reauthorization_required',
  providerVerified: false,
  refreshStartedAt: '2026-11-01T12:00:00.000Z',
  lockAgeSeconds: 200,
  incidentId,
  lastFailure: {
    incidentId,
    occurredAt: '2026-11-01T12:00:01.000Z',
    stage: 'token_refresh',
    code: 'http_error',
    httpStatus: 400,
    providerCode: 'invalid_grant',
  },
};

// Fake Resend: records each request; `provider` makes it fail.
const sent = [];
let provider = 'ok';
const heartbeats = [];
async function resend(url, options) {
  if (url === HEARTBEAT) {
    heartbeats.push(url);
    if (provider === 'down') throw new TypeError('fetch failed');
    return new Response(null);
  }
  assert.equal(url, 'https://api.resend.com/emails');
  sent.push({ key: options.headers['Idempotency-Key'], ...JSON.parse(options.body) });
  if (provider !== 'ok') return Response.json({ message: 'error' }, { status: Number(provider) });
  return Response.json({ id: `mail-${sent.length}` });
}

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('ALERTS_EMAIL_FROM', "Gonba's Garage <avisos@example.test>");
  vi.stubEnv('INTEGRATION_ALERT_EMAIL', OWNER);
  vi.stubEnv('ALERTS_TEST_RECIPIENT', undefined);
  vi.stubEnv('MERCADO_LIBRE_REDIRECT_URI', 'https://backend.example.test/api/mercado-libre/callback');
  vi.stubEnv('CRON_SECRET', 'test-cron-secret-never-used-outside-tests');
  // Without the full alert email configuration no customer alert work runs.
  vi.stubEnv('ALERTS_PUBLIC_URL', undefined);
  vi.stubGlobal('fetch', resend);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

it('loads only its expected runtime dependencies', () => {
  const dependencies = [
    'server-only',
    'node:crypto',
    '@/lib/alerts/config',
    '@/lib/alerts/email',
    '@/lib/catalog/store',
    '@/lib/database',
    '@/lib/env',
    './credentials',
    './failures',
  ];
  for (const id of runtimeImports('lib/integrations/mercado-libre/health-alerts.ts'))
    assert.ok(dependencies.includes(id), id);
});

describe('integration health thresholds', () => {
  const now = Date.parse('2026-11-02T12:00:00.000Z');
  const hoursAgo = hours => new Date(now - hours * 3_600_000).toISOString();
  const sync = ({ reconciliation = {}, jobs = {}, oldestOpenSyncedAt = hoursAgo(3) } = {}) => ({
    reconciliation: {
      lastStartedAt: hoursAgo(3),
      lastCompletedAt: hoursAgo(3),
      lastFailedAt: null,
      lastFailure: null,
      lastListed: 10,
      ...reconciliation,
    },
    jobs: { pending: 0, retrying: 0, deferred: 0, abandoned: 0, abandonedLastDay: 0, oldestPendingAt: null, ...jobs },
    publications: { active: 10 },
    lastSyncedAt: hoursAgo(3),
    oldestOpenSyncedAt,
  });
  const evaluate = (connection, input) => health.evaluateIntegrationHealth(connection, input, now);

  it('finds nothing wrong in a healthy integration, or during a renewal', () => {
    assert.deepEqual(evaluate(connected, sync()), []);
    assert.deepEqual(evaluate({ ...connected, state: 'renewing' }, sync()), []);
    assert.deepEqual(
      evaluate(
        connected,
        sync({ reconciliation: { lastFailedAt: hoursAgo(30), lastFailure: 'catalog_sync:timeout' } }),
      ),
      [],
      'A failure followed by a successful run is over',
    );
  });

  it('asks for reauthorization when the credential is blocked or missing', () => {
    const [finding] = evaluate(blocked, sync());
    assert.equal(finding.check, 'credential');
    assert.deepEqual(finding.reasons, ['reauthorization_required']);
    assert.equal(finding.facts.failure, 'token_refresh:http_error:400:invalid_grant');
    const older = evaluate(
      { ...blocked, lastFailure: { ...blocked.lastFailure, incidentId: '00000000-0000-4000-8000-000000000001' } },
      sync(),
    );
    assert.equal(older[0].facts.failure, null, 'A failure of an earlier incident is not reported as the cause');
    assert.deepEqual(evaluate({ state: 'not_connected', lastFailure: null }, sync())[0].reasons, ['not_connected']);
  });

  it('reports a failed, overdue or stale catalog sync', () => {
    const failed = evaluate(
      connected,
      sync({ reconciliation: { lastFailedAt: hoursAgo(1), lastFailure: 'catalog_sync:http_error:503' } }),
    );
    assert.deepEqual(
      failed.map(({ reasons }) => reasons),
      [['reconciliation_failed']],
    );
    assert.equal(failed[0].facts.failure, 'catalog_sync:http_error:503');
    const unsafe = evaluate(
      connected,
      sync({ reconciliation: { lastFailedAt: hoursAgo(1), lastFailure: `catalog_sync: ${secret}` } }),
    );
    assert.equal(unsafe[0].facts.failure, null, 'Only a well-formed failure code is kept');
    assert.deepEqual(
      evaluate(connected, sync({ reconciliation: { lastCompletedAt: hoursAgo(35) } })),
      [],
      'One missed daily run is tolerated',
    );
    assert.deepEqual(evaluate(connected, sync({ reconciliation: { lastCompletedAt: hoursAgo(37) } }))[0].reasons, [
      'reconciliation_overdue',
    ]);
    assert.deepEqual(evaluate(connected, sync({ reconciliation: { lastCompletedAt: null } }))[0].reasons, [
      'reconciliation_overdue',
    ]);
    assert.deepEqual(evaluate(connected, sync({ oldestOpenSyncedAt: hoursAgo(49) }))[0].reasons, ['copy_stale']);
    assert.deepEqual(evaluate(connected, sync({ oldestOpenSyncedAt: null })), [], 'An empty copy is not stale');
  });

  it('reports failing or stalled sync jobs above the thresholds only', () => {
    assert.deepEqual(evaluate(connected, sync({ jobs: { pending: 4, retrying: 2, abandonedLastDay: 2 } })), []);
    assert.deepEqual(evaluate(connected, sync({ jobs: { pending: 3, retrying: 3, abandonedLastDay: 2 } }))[0].reasons, [
      'jobs_failing',
    ]);
    assert.deepEqual(
      evaluate(connected, sync({ jobs: { pending: 1, oldestPendingAt: hoursAgo(25) } })),
      [],
      'A job queued after the cron waits for the next one',
    );
    assert.deepEqual(evaluate(connected, sync({ jobs: { pending: 1, oldestPendingAt: hoursAgo(27) } }))[0].reasons, [
      'jobs_stalled',
    ]);
  });
});

// Each step continues from the incidents and emails the previous one left.
describe('owner notifications', () => {
  let db;
  const query = async (text, values = []) => (await db.query(text, values)).rows;
  const alerts = async () =>
    Object.fromEntries((await query('SELECT * FROM public.integration_alerts')).map(row => [row.check_name, row]));
  const check = () => health.checkIntegrationHealth();
  const cron = route =>
    route.GET(
      new Request('https://example.test/cron', { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }),
    );
  const healthySync = async () => {
    await query(
      `UPDATE public.catalog_sync_runs SET last_completed_at = now(), last_failed_at = NULL, last_failure = NULL`,
    );
    await query('UPDATE public.catalog_publications SET synced_at = now()');
    await query('DELETE FROM public.catalog_sync_jobs');
  };

  beforeAll(async () => {
    db = await createDatabase();
    state.sql = createSql(() => db);
    await query(`INSERT INTO public.catalog_sync_runs (id, last_started_at, last_completed_at, last_listed)
      VALUES ('reconciliation', now(), now(), 1)`);
    await query(`INSERT INTO public.catalog_publications (publication_id, slug, status, price, currency, vehicle, source, vehicle_category)
      VALUES ('MLA1', 'auto-1', 'active', 1000, 'USD', '{}', '{}', 'MLA1744'),
        ('MLA2', 'auto-2', 'closed', 1000, 'USD', '{}', '{}', 'MLA1744')`);
  });
  afterAll(() => db.close());

  it('does nothing without an owner address', async () => {
    vi.stubEnv('INTEGRATION_ALERT_EMAIL', 'not an address');
    state.connection = blocked;
    assert.deepEqual(await check(), { enabled: false });
    vi.stubEnv('INTEGRATION_ALERT_EMAIL', OWNER);
    vi.stubEnv('RESEND_API_KEY', undefined);
    assert.deepEqual(await check(), { enabled: false }, 'An owner address alone cannot send');
    assert.equal(state.connectionReads, 0);
    assert.equal(sent.length, 0);
    assert.deepEqual(await alerts(), {});
  });

  it('sends nothing while the integration is healthy', async () => {
    state.connection = connected;
    await query(
      `UPDATE public.catalog_publications SET synced_at = now() - interval '30 days' WHERE status = 'closed'`,
    );
    await query(`INSERT INTO public.catalog_sync_jobs (publication_id, revision, processed_revision, last_error, updated_at)
      SELECT 'MLA' || n, 1, 1, 'catalog_sync:http_error:503', now() - interval '2 days' FROM generate_series(20, 29) n`);
    assert.deepEqual(
      await check(),
      { enabled: true, unhealthy: [], notified: false },
      'Closed cars are not read again daily, and jobs given up days ago are history',
    );
    assert.equal(sent.length, 0);
  });

  it('emails the owner once when the credential needs reauthorization, without secrets', async () => {
    state.connection = blocked;
    assert.deepEqual(await check(), { enabled: true, unhealthy: ['credential'], notified: true });
    assert.equal(sent.length, 1);
    const [email] = sent;
    assert.deepEqual(email.to, [OWNER]);
    assert.equal(email.subject, 'Acción necesaria: volver a conectar Mercado Libre');
    assert.match(
      email.text,
      /https:\/\/backend\.example\.test\/api\/mercado-libre\/connect/,
      'Links to the connect route on the callback host',
    );
    assert.match(email.text, /token_refresh:http_error:400:invalid_grant/);
    assert.match(email.text, new RegExp(incidentId));
    assert.match(email.html, /Volver a autorizar/);
    assert.match(email.key, /^integration-alert\/[a-f0-9]{64}$/);

    for (let run = 0; run < 3; run++) await check();
    assert.equal((await cron(dailyRoute)).status, 200);
    assert.equal(sent.length, 1, 'An ongoing incident is emailed once, not on every run');
    assert.equal((await alerts()).credential.notifications, 1);
  });

  it('reminds the owner after three days while it stays open', async () => {
    await query("UPDATE public.integration_alerts SET notified_at = now() - interval '2 days 23 hours'");
    await check();
    assert.equal(sent.length, 1);
    await query("UPDATE public.integration_alerts SET notified_at = now() - interval '3 days 1 hour'");
    await check();
    assert.equal(sent.length, 2);
    assert.match(sent[1].text, /Sigue pendiente desde el/);
    assert.notEqual(sent[1].key, sent[0].key);
    await check();
    assert.equal(sent.length, 2);
  });

  it('reports the recovery once, then stays quiet', async () => {
    const { incident_id: before } = (await alerts()).credential;
    state.connection = connected;
    await check();
    assert.equal(sent.length, 3);
    assert.equal(sent[2].subject, 'Mercado Libre: la sincronización volvió a funcionar');
    assert.match(sent[2].text, /Resuelto: Hay que volver a conectar Mercado Libre/);
    await check();
    assert.equal(sent.length, 3);
    state.connection = blocked;
    await check();
    assert.equal(sent.length, 4, 'A new failure is a new incident');
    assert.notEqual((await alerts()).credential.incident_id, before);
    assert.match(sent[3].text, /Nuevo: Hay que volver a conectar Mercado Libre/);
  });

  it('retries a failed send with the same key, and never reports an incident it never announced as resolved', async () => {
    state.connection = connected;
    await check();
    assert.equal(sent.length, 5);
    provider = '500';
    state.connection = new Error(secret);
    assert.equal((await check()).notified, false);
    assert.equal(sent.length, 6);
    assert.equal((await alerts()).credential.notifications, 0, 'A failed send is not recorded as sent');
    assert.equal((await check()).notified, false);
    assert.equal(sent[6].key, sent[5].key, 'A retried send keeps its idempotency key');
    assert.match(sent[6].text, /No se pudo leer la autorización guardada/);
    assert.equal(
      sent.some(({ text, html }) => text.includes(secret) || html.includes(secret)),
      false,
    );
    provider = 'ok';
    state.connection = connected;
    await check();
    assert.equal(sent.length, 7, 'An incident that cleared before any email reached the owner is dropped');
  });

  it('reports a failed reconciliation and failing jobs in one email, from the sync cron', async () => {
    state.reconcile = async () => {
      await query(
        `UPDATE public.catalog_sync_runs SET last_failed_at = now(), last_failure = 'catalog_sync:http_error:503'`,
      );
      throw failure('catalog_sync', 'http_error', { httpStatus: 503 });
    };
    await query(`INSERT INTO public.catalog_sync_jobs (publication_id, attempts, last_error)
      SELECT 'MLA' || n, 3, 'catalog_sync:http_error:503' FROM generate_series(10, 13) n`);
    await query(`INSERT INTO public.catalog_sync_jobs (publication_id, processed_revision, last_error)
      VALUES ('MLA14', 1, 'catalog_sync:http_error:503')`);
    await query(
      `UPDATE public.catalog_publications SET synced_at = now() - interval '3 days' WHERE publication_id = 'MLA1'`,
    );
    assert.equal((await cron(syncRoute)).status, 503);
    assert.equal(sent.length, 8);
    const email = sent[7];
    assert.equal(email.subject, 'Mercado Libre: la sincronización del catálogo necesita atención');
    assert.match(email.text, /Falló la última sincronización diaria/);
    assert.match(email.text, /catalog_sync:http_error:503/);
    assert.match(email.text, /cuya página no se actualiza desde el/);
    assert.match(
      email.text,
      /Fallan las lecturas de 5 publicaciones\. En reintento: 4\. Abandonadas en el último día: 1\./,
    );
    assert.deepEqual(Object.keys(await alerts()).sort(), ['catalog_sync', 'credential', 'sync_queue']);

    state.reconcile = async () => {
      await healthySync();
      return { skipped: false };
    };
    assert.equal((await cron(syncRoute)).status, 200);
    assert.equal(sent.length, 9);
    assert.equal(sent[8].text.match(/Resuelto/g).length, 2, 'Both incidents are reported resolved together');
  });

  it('calls the external monitor only when the daily sync completes', async () => {
    vi.stubEnv('INTEGRATION_HEARTBEAT_URL', HEARTBEAT);
    heartbeats.length = 0;
    await cron(syncRoute);
    assert.equal(heartbeats.length, 1);
    state.reconcile = async () => {
      throw failure('catalog_sync', 'http_error', { httpStatus: 503 });
    };
    assert.equal((await cron(syncRoute)).status, 503);
    assert.equal(heartbeats.length, 1, 'A failed sync stays silent, so the monitor warns');
    state.reconcile = async () => {
      await healthySync();
      return { skipped: false };
    };
    await cron(syncRoute);
    assert.equal(heartbeats.length, 2);
  });

  it('completes the sync when the monitor cannot be reached, without logging its URL', async () => {
    vi.stubEnv('INTEGRATION_HEARTBEAT_URL', HEARTBEAT);
    provider = 'down';
    await health.reportSyncCompleted();
    provider = 'ok';
    assert.equal((await cron(syncRoute)).status, 200);
    assert.equal(JSON.stringify(console.error.mock.calls).includes('secret-id'), false);
    assert.match(JSON.stringify(console.error.mock.calls), /integration_heartbeat_failure/);
  });

  it('never fails the cron when the check itself fails', async () => {
    const working = state.sql;
    state.sql = createSql(() => db, { query: true });
    assert.equal(await health.checkIntegrationHealthSafely(), null);
    assert.equal((await cron(dailyRoute)).status, 200);
    state.sql = working;
  });
});
