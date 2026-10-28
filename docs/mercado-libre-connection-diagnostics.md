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
Mercado Libre. Never put the API key in the URL.

- `not_connected`: no stored credential record.
- `connected`: a stored, unlocked record exists. `providerVerified: false` explicitly
  means this read-only check does not prove Mercado Libre will accept the token.
- `renewing`: a renewal lock is less than two minutes old.
- `reauthorization_required`: the lock is at least two minutes old and has not cleared.

The response includes the renewal's timestamp, age and incident ID (when known), plus
`lastFailure` with the latest safely recorded renewal failure. An old `lastFailure` can
remain after recovery; use the current state and timestamps when interpreting it.

## Distinguishing causes

| Stage | Evidence |
| --- | --- |
| `configuration` | A required server setting is missing. |
| `credential_read` / `credential_decrypt` | Reading or decrypting our credential failed. |
| `credential_lock` | Competing renewal, interrupted renewal or conditional lock-write failure. |
| `token_refresh` | Provider HTTP rejection, request timeout, network error or unclassified renewal failure. |
| `token_response` | Invalid response, unexpected seller or absent replacement token. |
| `credential_save` | The replacement credential could not be encrypted or saved. |
| `catalog_query` / `publication_diagnostics` | Publication request failed after the token step. |

An HTTP rejection records what the provider returned; it does not by itself assign blame.
For example, `invalid_client` can indicate our application configuration, while a 5xx or
timeout requires further provider/network evidence. Unknown provider text is omitted.

## Retention and limits

After an acquired renewal lock fails, the original safe incident is saved beside the
encrypted token in the private Blob record. Later blocked requests do not overwrite it.
Reauthorization and subsequent successful renewals preserve that incident, so it remains
available after Vercel's runtime log retention expires. Only the latest renewal failure is
retained; this is not an event history or an automatic notification system.

Conditional writes prevent a late failed attempt from replacing a newer authorization.
If saving the diagnostic itself fails, its safe error is logged separately. An abrupt
process termination may bypass catch handlers: the durable lock timestamp/incident ID and
the `mercado_libre_refresh_started` log are then the available evidence. A
`mercado_libre_refresh_saved` log confirms that the replacement reached storage.

Publication-query failures and failures before acquiring a lock are logged, but not
persisted in the credential record. Inspect those within Vercel's log retention window.
This change does not retroactively reconstruct earlier unrecorded failures.

The existing fail-closed renewal policy stays unchanged: do not clear a stale lock or
reuse an ambiguous one-use token automatically. Recover through the normal authorization
flow. This diagnostic work does not request new OAuth permissions or enable public access.

Run `npm run test:integration` for safe-metadata, rotation, history, concurrency and
protected/read-only endpoint regression tests. Tests simulate failures; never deliberately
break the production token to test diagnostics.
