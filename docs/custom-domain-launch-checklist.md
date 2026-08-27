# Custom-domain launch checklist

Use this checklist when Gonba Garage receives its final production domain. Replace
`https://<custom-domain>` below with the chosen canonical origin, including `www` if that is the
preferred public hostname.

## Current temporary setup

- Public URL: `https://gonba-garage.vercel.app`
- Hosting: Vercel
- Canonical URL source: `NEXT_PUBLIC_SITE_URL`
- Search Console: temporary URL-prefix property for the Vercel URL
- Analytics: the existing PostHog project named **Gonba Garage**

Before making changes, record the exact final domain, who controls its DNS, and which hostname is
canonical. Vercel recommends using `www` as the primary hostname and redirecting the apex domain to
it, but either direction is supported. Use one convention consistently.

## 1. Connect the domain to Vercel

- [ ] Add both `<custom-domain>` and `www.<custom-domain>` to the Gonba Garage Vercel project.
- [ ] Choose the canonical hostname: `https://<custom-domain>` or
  `https://www.<custom-domain>`.
- [ ] Configure the non-canonical hostname as a permanent redirect to the canonical hostname.
- [ ] Add the exact DNS records shown by Vercel to the domain's DNS provider. Do not copy generic A
  or CNAME values from documentation when the Vercel project shows project-specific records.
- [ ] If nameservers are moved to Vercel, copy every existing email and verification record first,
  including MX, SPF, DKIM, DMARC, and third-party TXT records.
- [ ] Wait for Vercel to report a valid configuration and provision the TLS certificate.
- [ ] Decide how the temporary `gonba-garage.vercel.app` hostname should behave. Prefer a permanent
  redirect to the matching path on the custom domain. If Vercel cannot redirect that generated
  hostname, keep it out of public links and rely on the custom-domain canonicals.

Reference: [Vercel custom-domain setup](https://vercel.com/docs/domains/set-up-custom-domain) and
[Vercel domain redirects](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).

## 2. Update the repository and Vercel environment

- [ ] Set `NEXT_PUBLIC_SITE_URL=https://<custom-domain>` in the Vercel **Production** environment.
- [ ] Set the same value for **Preview** only if previews should deliberately publish canonical and
  share URLs pointing to production. Otherwise, keep previews protected from indexing.
- [ ] Redeploy after changing the variable; existing deployments do not receive a new value
  retroactively.
- [ ] Replace the fallback `https://gonba-garage.vercel.app` in `lib/site-url.ts` with the final
  canonical origin.
- [ ] Keep `.env.example` generic. For local development, use
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000` unless testing production URLs intentionally.
- [ ] Update the ignored local `.env.local` only if local builds need to emit production-domain
  metadata.
- [ ] Search for any remaining temporary host references:

  ```bash
  rg -n "gonba-garage\.vercel\.app|vercel\.app" . \
    --glob '!node_modules/**' --glob '!.next/**'
  ```

Changing `NEXT_PUBLIC_SITE_URL` updates all URL-generating code already wired to it:

- root `metadataBase` and relative canonical tags;
- Open Graph and social-share URLs;
- vehicle structured data and offer URLs;
- `/sitemap.xml`;
- `/robots.txt` and its sitemap reference.

Do not replace references to Vercel that describe the hosting provider, package authors, or font
licenses. Only replace the temporary public hostname.

## 3. Update callbacks and external integrations

### Mercado Libre

The OAuth callback and webhook are planned in `docs/architecture.md`; complete these items when that
integration is enabled.

- [ ] Change `MERCADO_LIBRE_REDIRECT_URI` in Vercel to
  `https://<custom-domain>/api/mercado-libre/callback`.
- [ ] Add that exact redirect URI to the Mercado Libre developer application. Scheme, hostname,
  path, and trailing slash must match the deployed callback exactly.
- [ ] Change the Mercado Libre notification/webhook URL to
  `https://<custom-domain>/api/mercado-libre/webhook`.
- [ ] Redeploy, then run a fresh OAuth authorization and a test webhook delivery.
- [ ] Keep the client secret unchanged unless there is a separate reason to rotate it.

### Other services

- [ ] Update any Supabase Auth **Site URL** and redirect allow list if customer or admin login is
  added. The current site does not require this for its public pages.
- [ ] Update webhook endpoints, CORS allow lists, CAPTCHA allowed domains, maps APIs, storage/CDN
  origins, or form providers if any are added before launch.
- [ ] Update uptime checks and Vercel monitors to request the custom hostname.

## 4. Move Google Search Console to the custom domain

- [ ] Add a Search Console **Domain property** using only `<custom-domain>`—no protocol, path, or
  `www`—so it covers HTTPS, HTTP, apex, and subdomains.
- [ ] Add the Google-provided TXT verification record to DNS and verify ownership.
- [ ] Keep `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` during the migration if it is still needed for the
  temporary URL-prefix property. A DNS-verified Domain property does not depend on the HTML meta
  token.
- [ ] Submit `https://<custom-domain>/sitemap.xml` in the new property.
- [ ] Inspect the homepage, `/vehiculos`, `/vender`, and several vehicle detail URLs.
- [ ] Confirm every indexed page reports the custom-domain URL as its canonical.
- [ ] If the temporary Vercel Search Console property becomes verified and has meaningful history,
  keep it available during migration. Use Search Console's Change of Address only if the old
  property is eligible; the permanent redirects and new sitemap remain required either way.
- [ ] Monitor indexing, crawl errors, and search traffic in both properties during the transition.
- [ ] Keep redirects for at least one year; keeping them indefinitely is better for visitors using
  old links.

References: [Search Console property types](https://support.google.com/webmasters/answer/34592?hl=en)
and [Google's site-move guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

## 5. Confirm PostHog after the switch

The existing PostHog project and `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` can stay unchanged. A custom
domain does not require new analytics credentials.

- [ ] Open the custom-domain site and confirm `$pageview` and Gonba Garage custom events arrive in
  the same PostHog project.
- [ ] Update any PostHog dashboard filters, saved insights, toolbar URLs, allowed origins, or internal
  traffic rules that explicitly mention `gonba-garage.vercel.app`.
- [ ] Add a migration annotation with the launch date so traffic changes are easy to interpret.
- [ ] Filter out preview and Vercel-host traffic from production reporting if those hosts remain
  reachable.
- [ ] Confirm consent/privacy copy still accurately describes analytics collection.

## 6. Replace public-facing links

- [ ] Update the website link in Google Business Profile and all social profiles.
- [ ] Update Mercado Libre seller details and any other marketplace profile that links to the site.
- [ ] Update email signatures, QR codes, WhatsApp templates, proposals, invoices, printed material,
  and saved response templates.
- [ ] Ask owners of important external links to replace the Vercel URL with the custom domain.
- [ ] Confirm whether `ventas@gonbagarage.com.ar` matches the final domain and is active. If the
  final domain differs, update the email link in `app/vehiculos/[slug]/page.tsx` and configure the
  new mailbox before deployment.
- [ ] If the application starts sending email, configure and validate SPF, DKIM, and DMARC before
  using an address on the new domain.

There are no paid-ad destination URLs to update at present. Add that step later only if campaigns
are created.

## 7. Launch verification

- [ ] Confirm all canonical host variants resolve or redirect to the chosen canonical hostname.
- [ ] Confirm old paths redirect to the matching new paths, not all to the homepage.
- [ ] Check the response chain and TLS certificate:

  ```bash
  curl -I https://gonba-garage.vercel.app/vehiculos
  curl -I https://<custom-domain>/vehiculos
  curl -I https://www.<custom-domain>/vehiculos
  ```

- [ ] View page source and verify canonical, Open Graph, and Google verification metadata.
- [ ] Open `https://<custom-domain>/robots.txt` and confirm its sitemap line uses the custom domain.
- [ ] Open `https://<custom-domain>/sitemap.xml` and confirm every URL uses the custom domain.
- [ ] Test one vehicle share action and confirm the copied URL uses the custom domain.
- [ ] Test the buyer contact action, seller valuation flow, and price-alert flow.
- [ ] Confirm PostHog receives the expected events without personal data.
- [ ] Check mobile and desktop layouts, social link previews, 404s, and Vercel runtime logs.
- [ ] Monitor Search Console and PostHog daily for the first week, then weekly until indexing and
  traffic have stabilized.

## Completion record

Fill this in during launch:

| Item | Value |
| --- | --- |
| Final domain | |
| Canonical origin | |
| DNS provider | |
| Domain owner/contact | |
| Launch date | |
| Vercel domain verified | |
| Search Console property verified | |
| Sitemap submitted | |
| Old hostname redirects verified | |
| PostHog events verified | |
