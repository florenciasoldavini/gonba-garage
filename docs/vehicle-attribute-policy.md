# Public vehicle attribute policy

The registry in `features/vehicles/presentation/mercado-libre-attribute-policy.ts` is the
single source of truth for displaying attributes in a vehicle's public specification sheet.
It explicitly covers the 322 attributes returned by the MLA1744 (Autos y Camionetas)
category on 2026-10-28, plus separately identified legacy adapter and historical IDs.
The provider schema snapshot (IDs/names only) is in
`scripts/fixtures/mercado-libre-mla1744-attributes.json`.

Each ID has exactly one decision:

- `show`: general information, Motor y mecánica, Seguridad, Confort y equipamiento,
  or Dimensiones y capacidades. Empty sections are not rendered.
- `exclude`: an explicit reason. State/history and commercial terms are intentionally
  excluded for now (`history_disabled` and `commercial_terms`). Other reasons cover
  internal metadata, identifiers, unconfirmed warranties, regional metadata and fields
  belonging to non-car products previously listed by the seller.
- TRIM and SHORT_VERSION are displayed in general information only when their values
  are not already in the vehicle heading (`duplicate_in_title`).

The public sheet uses a single-column accordion. Información general starts open;
opening another section closes the previous one with a smooth transition. Empty
sections are omitted and reduced-motion preferences are respected.

Do not infer display decisions from Mercado Libre's `hidden` or `read_only` tags: those
also appear on useful engine, safety and equipment fields. Do not classify by HAS_/WITH_
prefixes or assign unknown fields to a catch-all section. New public sections require the
user's approval.

Unknown IDs have the explicit fallback decision `unmapped`: preserve the original API
data but do not publish the field until reviewed. The protected diagnostic endpoint
calculates `unmappedAttributes` with ID, name and originating publication IDs on request;
values remain available in its raw `items[].attributes`. This is not storage, a dashboard,
a scheduled check or an email alert. The original attributes always remain untouched,
including excluded fields, units, multiple values and boolean “No” values.

Run `npm run test:attributes` for offline coverage and regression checks. Run
`npm run test:attributes -- --live` to compare the current public category API with the
registry. A new unclassified ID fails that check. No periodic job is installed.
When reviewing new fields, add a deliberate show/exclude rule, update the schema snapshot
if appropriate, and rerun the checks. Existing legacy IDs may remain when removed from
the current schema; their rules must still be intentional and documented.
