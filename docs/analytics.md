# Analytics and search measurement

Gonba's Garage uses PostHog for on-site behavior and conversion funnels. Google Search Console owns
organic search visibility and indexing data. Supabase remains the source of truth for persisted
leads and business outcomes.

## PostHog setup

Create a client-owned PostHog Cloud project and configure these deployment variables:

```dotenv
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_SESSION_REPLAY=false
```

Analytics remains disabled when `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is empty. Keep the token out of
local development unless intentionally testing analytics, and avoid configuring it on disposable
preview deployments so they do not pollute production data.

Session replay is disabled independently by default. Before enabling it, verify the project-level
privacy settings and inspect test recordings. Inputs are masked by the SDK, and the valuation and
price-alert forms are explicitly excluded from autocapture.

No analytics event may include a name, email address, phone number, free-text notes, uploaded photo,
or full search query. Vehicle slugs and catalog attributes are permitted.

## Event taxonomy

| Event | Meaning |
| --- | --- |
| `vehicle_viewed` | A vehicle detail page was rendered in the browser. |
| `vehicle_shared` | A vehicle was shared or its link was copied successfully. |
| `inventory_filtered` | An inventory filter or search changed after a short debounce. |
| `inventory_zero_results` | The selected inventory criteria returned no vehicles. |
| `comparison_vehicle_added` | A vehicle was added to the comparison selection. |
| `comparison_vehicle_removed` | A vehicle was removed from the comparison selection. |
| `comparison_opened` | The comparison dialog opened with two or more vehicles. |
| `contact_intent_clicked` | A visitor clicked an email, WhatsApp, or internal contact action. This is intent, not a confirmed lead. |
| `price_alert_opened` | The price-alert dialog opened. |
| `price_alert_created` | The price-alert API confirmed a successful database write. |
| `price_alert_failed` | The price-alert request failed. |
| `valuation_started` | A visitor first interacted with the valuation form. |
| `valuation_step_completed` | A valid valuation step advanced. |
| `valuation_demo_completed` | The current demonstration form reached its success screen; this is not a submitted lead. |

Only introduce `valuation_submitted` after a production endpoint has accepted and persisted the
lead. Record downstream outcomes such as qualified lead, scheduled visit, and vehicle sold from the
system that owns those facts rather than from browser clicks.

## Google Search Console setup

The application exposes `/sitemap.xml` and `/robots.txt`. Both use `NEXT_PUBLIC_SITE_URL`, so replace
the local value with the canonical production origin before launch. While the site is a demo,
`SITE_INDEXING_ENABLED=false` keeps every page out of search results and serves an empty sitemap.

After the final domain is connected:

1. Replace demonstrative inventory and connect all production forms.
2. Set `SITE_INDEXING_ENABLED=true` and redeploy.
3. Add a Domain property in Google Search Console and verify it with the DNS record supplied by Google.
4. Submit `https://<production-domain>/sitemap.xml`.
5. Confirm that the homepage, inventory page, and several vehicle detail pages are indexed.

The complete Vercel, DNS, callback, SEO, analytics, and public-link migration sequence is in the
[custom-domain launch checklist](custom-domain-launch-checklist.md).

DNS verification is preferred because it covers the whole domain. If HTML-tag verification is
required instead, set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to the token from the Google meta tag;
the root metadata will emit the verification tag automatically.

## Initial reporting

Use qualified buyer and seller leads per week as the primary business metric. Build separate views
for acquisition, the buyer funnel, the seller funnel, and inventory demand. Search Console should be
used for impressions, queries, rankings, and clicks from Google; PostHog should be used for what
visitors do after landing on the site.
