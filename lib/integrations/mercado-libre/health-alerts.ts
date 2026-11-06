import 'server-only';
import { createHash } from 'node:crypto';
import { integrationAlertRecipients } from '@/lib/alerts/config';
import {
  buildIntegrationAlertEmail,
  EmailFailure,
  sendAlertEmail,
  type IntegrationAlertSection,
} from '@/lib/alerts/email';
import { readSyncHealth } from '@/lib/catalog/store';
import { getSql } from '@/lib/database';
import { integrationAlertEnv, mercadoLibreEnv } from '@/lib/env';
import { readConnectionDiagnostics } from './credentials';
import { safeFailure, type IntegrationIncident } from './failures';

/**
 * Tells the site owner, by email, when the Mercado Libre integration needs a person or is unhealthy.
 * Runs at the end of both daily crons, so a sync run that never finished is still noticed by the
 * alerts cron three hours later. Reads only the credential record and the database: it never
 * renews a token or calls Mercado Libre.
 */

const CHECKS = ['credential', 'catalog_sync', 'sync_queue'] as const;
type Check = (typeof CHECKS)[number];
type Reason =
  | 'not_connected'
  | 'reauthorization_required'
  | 'credential_unreadable'
  | 'reconciliation_failed'
  | 'reconciliation_overdue'
  | 'copy_stale'
  | 'jobs_failing'
  | 'jobs_stalled';
/** Safe evidence only: dates, counts and allowlisted failure codes. Never tokens or provider text. */
type Facts = {
  since?: string | null;
  failure?: string | null;
  incidentId?: string | null;
  lastCompletedAt?: string | null;
  oldestOpenSyncedAt?: string | null;
  retrying?: number;
  abandonedLastDay?: number;
  pending?: number;
  oldestPendingAt?: string | null;
};
export type HealthFinding = { check: Check; reasons: Reason[]; facts: Facts };
type ConnectionHealth =
  Awaited<ReturnType<typeof readConnectionDiagnostics>> | { state: 'unreadable'; failure: IntegrationIncident };
type SyncHealth = Awaited<ReturnType<typeof readSyncHealth>>;

const HOUR_MS = 60 * 60 * 1000;
/** The sync cron runs daily: one missed or interrupted run is tolerated, a second one is not. */
const RECONCILIATION_OVERDUE_HOURS = 36;
/** Active and paused cars are read again daily, so two days without a read means a stale page. */
const COPY_STALE_HOURS = 48;
/** Items being retried or given up in the last day. A few failing items is noise, more is a pattern. */
const FAILING_JOBS = 5;
/** Every due job is read by the next daily cron, so one untouched for longer is not being drained. */
const STALLED_JOB_HOURS = 26;
/** An incident still open is emailed again after this many days, never on every run. */
const REMIND_AFTER_DAYS = 3;

const older = (iso: string | null | undefined, hours: number, now: number) =>
  !!iso && now - Date.parse(iso) > hours * HOUR_MS;
const failureCode = ({ stage, code, httpStatus, providerCode }: IntegrationIncident) =>
  [stage, code, httpStatus, providerCode].filter(Boolean).join(':');
/** catalog_sync_runs.last_failure is written from a safe incident; anything else is dropped. */
const safeCode = (value: unknown) =>
  typeof value === 'string' && /^[a-z_]+(?::[a-z0-9_]+){0,3}$/.test(value) ? value : null;

/** Pure: the unhealthy checks, each with its reasons. Healthy checks are left out. */
export function evaluateIntegrationHealth(
  connection: ConnectionHealth,
  sync: SyncHealth,
  now = Date.now(),
): HealthFinding[] {
  const findings: HealthFinding[] = [];
  if (connection.state === 'unreadable') {
    findings.push({
      check: 'credential',
      reasons: ['credential_unreadable'],
      facts: { failure: failureCode(connection.failure) },
    });
  } else if (connection.state === 'not_connected') {
    findings.push({ check: 'credential', reasons: ['not_connected'], facts: {} });
  } else if (connection.state === 'reauthorization_required') {
    // An older recorded failure may belong to an earlier, already recovered incident.
    const failure = connection.lastFailure?.incidentId === connection.incidentId ? connection.lastFailure : null;
    findings.push({
      check: 'credential',
      reasons: ['reauthorization_required'],
      facts: {
        since: connection.refreshStartedAt,
        incidentId: connection.incidentId,
        failure: failure ? failureCode(failure) : null,
      },
    });
  }

  const { reconciliation } = sync;
  const catalog: Reason[] = [];
  if (
    reconciliation.lastFailedAt &&
    (!reconciliation.lastCompletedAt ||
      Date.parse(reconciliation.lastFailedAt) > Date.parse(reconciliation.lastCompletedAt))
  )
    catalog.push('reconciliation_failed');
  if (!reconciliation.lastCompletedAt || older(reconciliation.lastCompletedAt, RECONCILIATION_OVERDUE_HOURS, now)) {
    catalog.push('reconciliation_overdue');
  }
  if (older(sync.oldestOpenSyncedAt, COPY_STALE_HOURS, now)) catalog.push('copy_stale');
  if (catalog.length) {
    findings.push({
      check: 'catalog_sync',
      reasons: catalog,
      facts: {
        failure: catalog.includes('reconciliation_failed') ? safeCode(reconciliation.lastFailure) : null,
        lastCompletedAt: reconciliation.lastCompletedAt,
        oldestOpenSyncedAt: sync.oldestOpenSyncedAt,
      },
    });
  }

  const { jobs } = sync;
  const queue: Reason[] = [];
  if (jobs.retrying + jobs.abandonedLastDay >= FAILING_JOBS) queue.push('jobs_failing');
  if (older(jobs.oldestPendingAt, STALLED_JOB_HOURS, now)) queue.push('jobs_stalled');
  if (queue.length) {
    findings.push({
      check: 'sync_queue',
      reasons: queue,
      facts: {
        retrying: jobs.retrying,
        abandonedLastDay: jobs.abandonedLastDay,
        pending: jobs.pending,
        oldestPendingAt: jobs.oldestPendingAt,
      },
    });
  }
  return findings;
}

const titles: Record<Check, string> = {
  credential: 'Hay que volver a conectar Mercado Libre',
  catalog_sync: 'La copia del catálogo no se está actualizando',
  sync_queue: 'Hay publicaciones que no se pueden actualizar',
};

function date(iso: unknown) {
  const time = typeof iso === 'string' ? Date.parse(iso) : NaN;
  return Number.isFinite(time)
    ? new Date(time).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        dateStyle: 'short',
        timeStyle: 'short',
        hourCycle: 'h23',
      })
    : null;
}

function explain(reason: Reason, facts: Facts) {
  const count = (value: unknown) => (Number.isInteger(value) ? Number(value) : 0);
  switch (reason) {
    case 'not_connected':
      return 'No hay una autorización de Mercado Libre guardada.';
    case 'reauthorization_required':
      return 'La renovación del acceso a Mercado Libre falló o quedó interrumpida. Para no reutilizar un token que Mercado Libre puede haber consumido, el acceso queda bloqueado hasta volver a autorizar.';
    case 'credential_unreadable':
      return 'No se pudo leer la autorización guardada de Mercado Libre.';
    case 'reconciliation_failed':
      return 'Falló la última sincronización diaria con Mercado Libre.';
    case 'reconciliation_overdue': {
      const last = date(facts.lastCompletedAt);
      return last
        ? `La sincronización diaria no termina bien desde el ${last}.`
        : 'La sincronización diaria nunca terminó bien.';
    }
    case 'copy_stale':
      return `Hay autos disponibles o reservados cuya página no se actualiza desde el ${date(facts.oldestOpenSyncedAt)}: el sitio puede mostrar precios o estados viejos.`;
    case 'jobs_failing':
      return `Fallan las lecturas de ${count(facts.retrying) + count(facts.abandonedLastDay)} publicaciones. En reintento: ${count(facts.retrying)}. Abandonadas en el último día: ${count(facts.abandonedLastDay)}.`;
    case 'jobs_stalled':
      return `Hay publicaciones en cola sin procesar desde el ${date(facts.oldestPendingAt)}. Pendientes: ${count(facts.pending)}.`;
  }
}

/** The connect route must run on the callback's host, where its OAuth cookies are read back. */
function connectUrl() {
  const callback = URL.parse(mercadoLibreEnv.redirectUri() ?? '');
  return callback ? `${callback.origin}/api/mercado-libre/connect` : null;
}

type Due = {
  check: Check;
  incidentId: string;
  open: boolean;
  notifications: number;
  openedAt: string;
  reasons: Reason[];
  facts: Facts;
};

function section(alert: Due): IntegrationAlertSection {
  const opened = date(alert.openedAt);
  if (!alert.open) {
    return {
      title: titles[alert.check],
      status: 'Resuelto',
      lines: [`Volvió a funcionar. Había empezado el ${opened}. No hace falta hacer nada.`],
    };
  }
  const { facts } = alert;
  const lines = alert.reasons.map(reason => explain(reason, facts));
  lines.push('Mientras tanto, el sitio sigue mostrando la última copia guardada del catálogo.');
  let action;
  if (alert.check === 'credential') {
    const url = connectUrl();
    lines.push(
      `Para resolverlo, abrí ${url ? 'el enlace de abajo' : '/api/mercado-libre/connect en el backend'}, entrá con el usuario admin y la clave privada del catálogo, y autorizá con la cuenta vendedora de Mercado Libre.`,
    );
    if (url) action = { label: 'Volver a autorizar', url };
  } else {
    lines.push(
      'Si Mercado Libre también figura desconectado, volver a autorizarlo lo resuelve. Si no, revisá /api/mercado-libre/diagnostics?sync=1 y los registros de Vercel.',
    );
  }
  const technical = [
    safeCode(facts.failure) && `código ${safeCode(facts.failure)}`,
    typeof facts.incidentId === 'string' && /^[a-f0-9-]{36}$/.test(facts.incidentId) && `incidente ${facts.incidentId}`,
    date(facts.since) && `bloqueado desde el ${date(facts.since)}`,
  ].filter(Boolean);
  if (technical.length) lines.push(`Detalle técnico: ${technical.join(', ')}.`);
  return {
    title: titles[alert.check],
    status: alert.notifications === 0 ? 'Nuevo' : `Sigue pendiente desde el ${opened}`,
    lines,
    action,
  };
}

/**
 * Opens an incident for each unhealthy check (or updates the open one), and resolves the open
 * incident of each healthy check.
 */
async function recordFindings(findings: HealthFinding[]) {
  const sql = getSql();
  for (const check of CHECKS) {
    const finding = findings.find(item => item.check === check);
    if (!finding) {
      await sql`UPDATE public.integration_alerts SET resolved_at = now() WHERE check_name = ${check} AND resolved_at IS NULL`;
      continue;
    }
    // Every SET expression reads the row as it was, so a resolved row starts a fresh incident.
    await sql`INSERT INTO public.integration_alerts AS alert (check_name, incident_id, details)
      VALUES (${check}, gen_random_uuid(), ${JSON.stringify({ reasons: finding.reasons, facts: finding.facts })}::jsonb)
      ON CONFLICT (check_name) DO UPDATE SET details = EXCLUDED.details, last_seen_at = now(),
        incident_id = CASE WHEN alert.resolved_at IS NULL THEN alert.incident_id ELSE EXCLUDED.incident_id END,
        opened_at = CASE WHEN alert.resolved_at IS NULL THEN alert.opened_at ELSE now() END,
        notifications = CASE WHEN alert.resolved_at IS NULL THEN alert.notifications ELSE 0 END,
        notified_at = CASE WHEN alert.resolved_at IS NULL THEN alert.notified_at END,
        resolution_notified_at = NULL, resolved_at = NULL`;
  }
}

/**
 * New incidents, open ones last emailed REMIND_AFTER_DAYS ago, and resolutions of incidents that
 * were emailed. An incident resolved before its first email was sent is never mentioned.
 */
async function dueNotifications(): Promise<Due[]> {
  const rows = await getSql()`SELECT check_name, incident_id, details, opened_at, resolved_at, notifications
    FROM public.integration_alerts
    WHERE CASE WHEN resolved_at IS NULL
      THEN notified_at IS NULL OR notified_at < now() - ${REMIND_AFTER_DAYS}::int * interval '1 day'
      ELSE notifications > 0 AND resolution_notified_at IS NULL END`;
  return rows
    .map(row => ({
      check: row.check_name as Check,
      incidentId: String(row.incident_id),
      open: row.resolved_at === null,
      notifications: Number(row.notifications),
      openedAt: new Date(row.opened_at as string).toISOString(),
      reasons: (row.details as { reasons: Reason[] }).reasons,
      facts: (row.details as { facts: Facts }).facts,
    }))
    .sort((a, b) => CHECKS.indexOf(a.check) - CHECKS.indexOf(b.check));
}

/** One email for everything due. Returns whether the provider accepted it. */
async function notify(to: string[], due: Due[]) {
  const open = due.filter(alert => alert.open);
  const subject = open.some(alert => alert.check === 'credential')
    ? 'Acción necesaria: volver a conectar Mercado Libre'
    : open.length
      ? 'Mercado Libre: la sincronización del catálogo necesita atención'
      : 'Mercado Libre: la sincronización volvió a funcionar';
  const email = buildIntegrationAlertEmail({
    to,
    subject,
    sections: due.map(section),
    intro: 'Aviso automático del control diario de la integración con Mercado Libre.',
  });
  // The same pending set always gets the same key, so a retried or concurrent send is one email.
  const key = createHash('sha256')
    .update(due.map(alert => `${alert.incidentId}:${alert.open}:${alert.notifications}`).join(','))
    .digest('hex');
  try {
    await sendAlertEmail(email, `integration-alert/${key}`);
  } catch (error) {
    if (!(error instanceof EmailFailure)) throw error;
    // Nothing is marked as sent, so the next check tries again.
    console.error(JSON.stringify({ event: 'integration_alert_email_failure', code: error.code }));
    return false;
  }
  const sql = getSql();
  for (const alert of due) {
    // Only the incident, and the state, that was emailed.
    await sql`UPDATE public.integration_alerts SET
        notifications = notifications + CASE WHEN ${alert.open}::boolean THEN 1 ELSE 0 END,
        notified_at = CASE WHEN ${alert.open}::boolean THEN now() ELSE notified_at END,
        resolution_notified_at = CASE WHEN ${alert.open}::boolean THEN NULL ELSE now() END
      WHERE check_name = ${alert.check} AND incident_id = ${alert.incidentId}::uuid
        AND (resolved_at IS NULL) = ${alert.open}::boolean AND notifications = ${alert.notifications}::int`;
  }
  return true;
}

/** Without INTEGRATION_ALERT_EMAIL (and the Resend configuration) this does nothing at all. */
export async function checkIntegrationHealth() {
  const to = integrationAlertRecipients();
  if (!to.length) return { enabled: false as const };
  const [connection, sync] = await Promise.all([
    readConnectionDiagnostics().catch((error): ConnectionHealth => ({
      state: 'unreadable',
      failure: safeFailure(error, 'credential_read').incident,
    })),
    readSyncHealth(),
  ]);
  const findings = evaluateIntegrationHealth(connection, sync);
  await recordFindings(findings);
  const due = await dueNotifications();
  const notified = due.length > 0 && (await notify(to, due));
  return { enabled: true as const, unhealthy: findings.map(finding => finding.check), notified };
}

/** For the crons: a failing health check must never fail the work that ran before it. */
export async function checkIntegrationHealthSafely() {
  try {
    return await checkIntegrationHealth();
  } catch {
    console.error(JSON.stringify({ event: 'integration_health_check_failure' }));
    return null;
  }
}

/**
 * A cron that stops firing can email nobody, so the daily sync calls an external monitor when it
 * completes, and the monitor warns when that call does not arrive. Optional; a failed call is
 * only logged. The URL is a secret of the monitor, so it is never logged.
 */
export async function reportSyncCompleted() {
  const url = integrationAlertEnv.heartbeatUrl();
  if (!url) return;
  try {
    await fetch(url, { signal: AbortSignal.timeout(5_000) });
  } catch {
    console.error(JSON.stringify({ event: 'integration_heartbeat_failure' }));
  }
}
