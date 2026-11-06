# Mercado Libre connection diagnostics

The catalog returns a generic 503 to avoid exposing account or credential details. Its
protected response now includes `incidentId`, which can be matched to a structured
`mercado_libre_failure` entry in Vercel's runtime logs.

The failure fields are strictly allowlisted: incident ID, UTC timestamp, stage, fixed error
code, HTTP status when available, and a recognized provider error code such as
`invalid_grant`. Raw messages, response bodies, authorization headers, request URLs, access
tokens, refresh tokens and their ciphertext are never included in those logs or responses.

## Read-only status

The existing protected diagnostic endpoint accepts `?connection=1`. It uses the same
server-side catalog API key as the catalog and returns `private, no-store` / `noindex`.
It reads the credential record; it does not make a token request, clear locks or contact
Mercado Libre. It never returns the encrypted refresh or access token. Never put the API key in the URL.

- `not_connected`: no stored credential record.
- `connected`: a stored, unlocked record exists. `providerVerified: false` explicitly
  means this read-only check does not prove Mercado Libre will accept the token.
- `retrying`: the last renewal failed without consuming the refresh token (see "Released
  renewals" below). The lock is released and the next renewal is tried after `retryAfter`.
- `renewing`: a renewal lock is less than two minutes old and has not recorded a failure. Other
  instances wait for it, up to 25 seconds, and reuse the access token it stores instead of failing
  immediately.
- `reauthorization_required`: the renewal recorded a failure while holding the lock, or the lock
  is at least two minutes old and has not cleared. Nothing recovers on its own: authorize again at
  `/api/mercado-libre/connect`. `reauthorizationRequired: true` repeats this as a boolean.

## Released renewals

A renewal locks the record before it spends the one-use refresh token. The lock is released,
keeping the same refresh token, only when the failure proves the token was not consumed:

- `token_refresh: connection_failed`: the request never left the server. DNS failed, the
  connection was refused or unreachable, or Node's own connect timeout (about 10 seconds) expired.
- `token_refresh: http_error` with status 429 or 5xx: Mercado Libre answered with an error, not a
  token. Should a 5xx have consumed the token anyway, the next attempt gets `invalid_grant`, a
  definite rejection that keeps the lock, which is no worse than keeping it at once.

The failure is recorded as `lastFailure`, a `mercado_libre_refresh_released` warning is logged,
and for one minute (`retryAfter`) every request reports that failure without contacting Mercado
Libre. After that the next request renews normally.

Everything else keeps the lock (fail closed): our own 20-second request timeout, a connection
dropped after it was established (`network_error`), any other HTTP rejection such as
`invalid_grant`, an unreadable or unexpected token response, and a replacement that could not be
saved. Those can follow a consumed token.

## Alerting on a stuck connection

Each request blocked by a lock that needs reauthorization logs a structured
`mercado_libre_reauthorization_required` error with the lock age and the recorded failure. So
does the renewal that keeps the lock. The event repeats while the state lasts. `GET
/api/mercado-libre/diagnostics?connection=1` reports the same state, and the sync cron answers 503
with the incident while it lasts. Vercel Hobby keeps logs for an hour, so the owner notifications
below are what actually tells someone.

## Response details

The response includes the renewal's timestamp, age and incident ID (when known), plus
`lastFailure` with the latest safely recorded renewal failure. An old `lastFailure` can
remain after recovery; use the current state and timestamps when interpreting it.

## Distinguishing causes

| Stage                                       | Evidence                                                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `configuration`                             | A required server setting is missing.                                                                                                        |
| `credential_read` / `credential_decrypt`    | Reading or decrypting our credential failed.                                                                                                 |
| `credential_lock`                           | Competing renewal, interrupted renewal or conditional lock-write failure.                                                                    |
| `token_refresh`                             | Provider HTTP rejection, request timeout, network error, connection never established (`connection_failed`) or unclassified renewal failure. |
| `token_response`                            | Invalid response, unexpected seller or absent replacement token.                                                                             |
| `credential_save`                           | The replacement credential could not be encrypted or saved.                                                                                  |
| `catalog_query` / `publication_diagnostics` | Publication request failed after the token step.                                                                                             |

An HTTP rejection records what the provider returned; it does not by itself assign blame.
For example, `invalid_client` can indicate our application configuration, while a 5xx or
timeout requires further provider/network evidence. Unknown provider text is omitted.

## Retention and limits

After an acquired renewal lock fails, the original safe incident is saved beside the
encrypted token in the private Blob record. Later blocked requests do not overwrite it.
Reauthorization and subsequent successful renewals preserve that incident, so it remains
available after Vercel's runtime log retention expires. Only the latest renewal failure is
retained; this is not an event history. The owner notifications below are the alerting layer.

Conditional writes prevent a late failed attempt from replacing a newer authorization.
If saving the diagnostic itself fails, its safe error is logged separately. An abrupt
process termination may bypass catch handlers: the durable lock timestamp/incident ID and
the `mercado_libre_refresh_started` log are then the available evidence. A
`mercado_libre_refresh_saved` log confirms that the replacement reached storage.

Publication-query failures and failures before acquiring a lock are logged, but not
persisted in the credential record. Inspect those within Vercel's log retention window.
This change does not retroactively reconstruct earlier unrecorded failures.

Apart from the released renewals above, the renewal policy is fail closed: do not clear a
stale lock or reuse an ambiguous one-use token automatically. Recover through the normal
authorization flow. This diagnostic work does not request new OAuth permissions or enable public access.

## Owner notifications

Vercel Hobby keeps runtime logs for an hour, so nobody would see a failure in time. Instead,
`lib/integrations/mercado-libre/health-alerts.ts` emails the site owner when the integration needs
a person or is unhealthy. It runs in both daily crons (`/api/mercado-libre/sync` at 09:00 UTC, after
the reconciliation, whether it succeeded or not, and `/api/alerts/daily` at 12:00 UTC, which also
notices a sync run that never finished). No extra cron is needed. It reads the credential record
(as `?connection=1`) and the sync health (as `?sync=1`); it never renews a token or calls Mercado
Libre, and a failing check never fails the cron.

| Check          | Opens an incident when                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credential`   | The state is `reauthorization_required` or `not_connected`, or the record cannot be read. The email links to `/api/mercado-libre/connect` on the host of `MERCADO_LIBRE_REDIRECT_URI`. `retrying` is not an incident: it recovers on its own. |
| `catalog_sync` | The last reconciliation failed, no reconciliation has completed for 36 hours (one missed daily run is tolerated), or an active or paused car has not been read for 48 hours.                                                                  |
| `sync_queue`   | At least five items are being retried or were given up in the last day, or a queued item has not been touched for 26 hours (the daily cron reads every due item).                                                                             |

Deduplication (`integration_alerts`, one row per check): an incident is emailed when it opens,
then only as a reminder every three days while it stays open, and once more when it resolves.
Everything due in one run goes in a single email. An incident that clears before any email
reached the owner is dropped silently. A failed send is retried by the next check with the same
Resend idempotency key, so a retry cannot become a second copy. A check that fails again after
resolving opens a new incident.

Emails carry only fixed text, dates, counts, the incident ID and allowlisted failure codes such as
`token_refresh:http_error:400:invalid_grant`, never tokens, provider messages or payloads.

Configuration (server-only, Production only): `INTEGRATION_ALERT_EMAIL`, one or more
comma-separated owner addresses, plus the existing `DATABASE_URL`, `RESEND_API_KEY` and
`ALERTS_EMAIL_FROM`. Without all of them nothing is checked or sent. `ALERTS_TEST_RECIPIENT`, when
set, also blocks these emails to any other address. Apply `20261106_integration_alerts.sql` with
`npm run db:migrate` before setting the address; until then the check logs
`integration_health_check_failure` and the crons work as before.

### Crons that stop firing

A cron that never runs can email nobody: a rejected `CRON_SECRET` leaves no trace at all. For that
case, set `INTEGRATION_HEARTBEAT_URL` to the ping URL of an external monitor (for example a free
Healthchecks.io check on a daily period with a few hours of grace). The sync cron calls it when a
run completes, so the monitor warns when a day passes without one. It is optional, and a failed
call is only logged. The URL is never logged.

Run `npm run test:integration` for safe-metadata, rotation, history, concurrency and
protected/read-only endpoint regression tests. Tests simulate failures; never deliberately
break the production token to test diagnostics.
