import assert from 'node:assert/strict';

const targetOrigin = new URL(process.argv[2] || 'http://localhost:3100');
const indexingEnabled = process.env.SITE_INDEXING_ENABLED === 'true';
// Run with the same environment as the server. Alerts are offered only where alert emails can be
// sent: the same check as alertEmailsConfigured() in lib/alerts/config.ts.
const alertsEnabled = (() => {
  try {
    const origin = new URL(process.env.ALERTS_PUBLIC_URL || '');
    return origin.protocol === 'https:' && origin.pathname === '/' && !origin.search && !origin.hash && !origin.username
      && Boolean(process.env.DATABASE_URL && process.env.RESEND_API_KEY && process.env.ALERTS_EMAIL_FROM)
      && (process.env.ALERTS_SIGNING_SECRET?.length ?? 0) >= 32;
  } catch { return false; }
})();
for (const path of ['/api/mercado-libre/catalog', '/api/mercado-libre/connect', '/api/mercado-libre/diagnostics']) {
  const response = await fetch(new URL(path, targetOrigin));
  assert.equal(response.status, 401, `${path} must reject unauthenticated requests`);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
}
// Alert management and catalog sync are never indexable, even when production indexing is enabled.
for (const [path, status] of [['/api/alerts/daily', 401], ['/api/mercado-libre/sync', 401], ['/api/price-alerts/cancel', 400],
  ['/api/inventory-alerts/cancel', 400], ['/api/alerts/confirm', 303]]) {
  const response = await fetch(new URL(path, targetOrigin), { redirect: 'manual' });
  assert.equal(response.status, status, path);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
}
// Emailed confirmation links never activate on GET; invalid ones redirect to the result page.
const confirmLink = await fetch(new URL('/api/alerts/confirm?token=invalid', targetOrigin), { redirect: 'manual' });
assert.equal(confirmLink.status, 303);
assert.match(confirmLink.headers.get('cache-control') ?? '', /private/);
assert.equal(confirmLink.headers.get('location'), '/alertas/confirmacion?estado=no-valido');
// Site-wide framing protection must not replace the alert pages' stricter route-level policies.
const sitePage = await fetch(new URL('/', targetOrigin));
assert.equal(sitePage.headers.get('x-frame-options'), 'DENY');
assert.match(sitePage.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
for (const path of ['/api/price-alerts/cancel', '/api/inventory-alerts/cancel']) {
  const alertLinkPage = await fetch(new URL(`${path}?token=invalid`, targetOrigin));
  assert.match(alertLinkPage.headers.get('content-security-policy') ?? '', /^default-src 'none';/, path);
  assert.equal(alertLinkPage.headers.get('referrer-policy'), 'no-referrer', path);
}
assert.notEqual(process.env.VEHICLE_DATA_SOURCE, 'mercado-libre',
  'Run the permanent/demo metadata contract without the temporary local session. Live preview must remain noindex with an empty sitemap.');

const routes = [
  { path: '/', title: "Gonba's Garage | Autos usados seleccionados" },
  { path: '/vehiculos', title: "Vehículos disponibles | Gonba's Garage" },
  { path: '/vender', title: "Vendé tu auto | Gonba's Garage" },
  { path: '/privacidad', title: "Política de privacidad | Gonba's Garage" },
  { path: '/terminos', title: "Términos y condiciones | Gonba's Garage" },
  {
    path: '/vehiculos/bmw-330i-m-sport-2021',
    title: "BMW 330i 2021 | Gonba's Garage",
  },
  {
    path: '/vehiculos/mercedes-benz-190sl-1962',
    title: "Mercedes-Benz 190 SL 1962 | Gonba's Garage",
  },
  {
    path: '/vehiculos/porsche-356-b-1961',
    title: "Porsche 356 B 1961 | Gonba's Garage",
  },
];

function decodeHtml(value) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [
      name,
      decodeHtml(value),
    ]),
  );
}

function getMetadata(html) {
  const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(([tag]) => getAttributes(tag));
  const find = (attribute, value) => tags.find((tag) => tag[attribute] === value);
  const title = decodeHtml(html.match(/<title>(.*?)<\/title>/)?.[1] || '');

  return {
    title,
    description: find('name', 'description')?.content,
    canonical: find('rel', 'canonical')?.href,
    icon: find('rel', 'icon')?.href,
    appleIcon: find('rel', 'apple-touch-icon')?.href,
    manifest: find('rel', 'manifest')?.href,
    robots: find('name', 'robots')?.content,
    googleBot: find('name', 'googlebot')?.content,
    openGraph: {
      title: find('property', 'og:title')?.content,
      description: find('property', 'og:description')?.content,
      url: find('property', 'og:url')?.content,
      siteName: find('property', 'og:site_name')?.content,
      locale: find('property', 'og:locale')?.content,
      type: find('property', 'og:type')?.content,
      image: find('property', 'og:image')?.content,
      imageAlt: find('property', 'og:image:alt')?.content,
    },
    twitter: {
      card: find('name', 'twitter:card')?.content,
      title: find('name', 'twitter:title')?.content,
      description: find('name', 'twitter:description')?.content,
      image: find('name', 'twitter:image')?.content,
      imageAlt: find('name', 'twitter:image:alt')?.content,
    },
  };
}

function getJsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(
    ([, json]) => JSON.parse(json),
  );
}

function normalizeUrl(value) {
  const url = new URL(value);
  return url.pathname === '/' ? url.toString().replace(/\/$/, '') : url.toString();
}

const results = [];
let canonicalOrigin;

for (const route of routes) {
  const response = await fetch(new URL(route.path, targetOrigin));
  assert.equal(response.status, 200, `${route.path} should return 200`);
  assert.match(response.headers.get('content-type') || '', /^text\/html/, `${route.path} should return HTML`);

  const html = await response.text();
  const metadata = getMetadata(html);
  const jsonLd = getJsonLd(html);

  if (route.path === '/') {
    assert.ok(metadata.canonical, 'Home should define a canonical URL');
    canonicalOrigin = new URL(metadata.canonical).origin;

    const siteGraph = jsonLd.flatMap((entry) => entry['@graph'] || []);
    assert.ok(siteGraph.some((entry) => entry['@type'] === 'WebSite'), 'Home should describe the website');
    const dealer = siteGraph.find((entry) => entry['@type'] === 'AutoDealer');
    assert.ok(dealer, 'Home should describe the business');
    // The dealer is located by locality only and receives visits by appointment, so the graph must
    // never publish a street address or opening hours that would read as walk-in hours.
    assert.deepEqual(dealer.address, {
      '@type': 'PostalAddress',
      addressLocality: 'Villa Pueyrredón',
      addressRegion: 'CABA',
      addressCountry: 'AR',
    });
    for (const property of ['openingHours', 'openingHoursSpecification']) {
      assert.ok(!(property in dealer), `AutoDealer must not publish ${property}`);
    }
    // The address is a visible fact: the footer shows the same area beside the appointment-only hours.
    const footerText = decodeHtml(html.match(/<footer\b.*?<\/footer>/s)?.[0].replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ') ?? '').replace(/\s+/g, ' ');
    for (const fact of ['Villa Pueyrredón, CABA', 'Lunes a viernes de 10 a 18 h', 'Sábados de 10 a 13 h', 'Siempre con cita previa', 'Pedí tu cita']) {
      assert.ok(footerText.includes(fact), `Footer must show "${fact}"`);
    }
    assert.ok(metadata.icon, 'Home should link the branded favicon');
    assert.ok(metadata.appleIcon, 'Home should link the Apple touch icon');
    assert.ok(metadata.manifest, 'Home should link the web manifest');
    assert.ok(!html.includes('Demo visual · Contenido e información comercial a confirmar'), 'Home footer must omit the obsolete demo note');

    const featuredLinks = [...html.matchAll(/<a\b[^>]*class="[^"]*vehicle-card-link[^"]*"[^>]*>/g)]
      .map(([tag]) => getAttributes(tag).href);
    assert.ok(featuredLinks.length > 0 && featuredLinks.length <= 3, 'Home must show up to three available catalog vehicles');
    assert.equal(new Set(featuredLinks).size, featuredLinks.length, 'Home vehicle links must be unique');
    const featuredBadges = [...html.matchAll(/<span class="vehicle-status">([^<]*)<\/span>/g)]
      .map(([, label]) => decodeHtml(label));
    assert.equal(featuredBadges.length, featuredLinks.length, 'Every home vehicle card must show a status badge');
    for (const [index, href] of featuredLinks.entries()) {
      assert.match(href, /^\/vehiculos\/[^/?#]+$/);
      const detail = await fetch(new URL(href, targetOrigin));
      assert.equal(detail.status, 200, `Home vehicle link ${href} must resolve`);
      // The badge comes from the vehicle's status, the same one behind the detail label and Offer.
      const detailHtml = await detail.text();
      const detailLabel = decodeHtml(detailHtml.match(/class="detail-availability"[^>]*><span><\/span> ?(?:<!-- -->)?([^<]*)</)?.[1] ?? '');
      const offer = getJsonLd(detailHtml).flatMap((entry) => entry['@graph'] || [])
        .find((entry) => Array.isArray(entry['@type']) && entry['@type'].includes('Product'))?.offers;
      assert.equal(featuredBadges[index], detailLabel, `Home badge for ${href} must match its detail page status`);
      assert.equal(featuredBadges[index], 'Disponible', `Home must only feature available vehicles (${href})`);
      assert.equal(offer?.availability, 'https://schema.org/InStock', `Featured ${href} must be InStock`);
    }
  }

  if (route.path === '/vehiculos') {
    assert.doesNotMatch(
      response.headers.get('cache-control') || '',
      /no-store|private/,
      'Inventory should remain statically cacheable',
    );
  }

  if (route.path.startsWith('/vehiculos/')) {
    assert.match(response.headers.get('cache-control') || '', /no-store/,
      'Vehicle details must render at request time, including live slugs absent during build');
    const vehicleGraph = jsonLd.flatMap((entry) => entry['@graph'] || []);
    const product = vehicleGraph.find((entry) => Array.isArray(entry['@type']) && entry['@type'].includes('Product'));
    const breadcrumb = vehicleGraph.find((entry) => entry['@type'] === 'BreadcrumbList');

    assert.ok(product, `${route.path} should describe a Product and Vehicle`);
    assert.equal(product.offers?.itemCondition, 'https://schema.org/UsedCondition', `${route.path} should identify a used vehicle`);
    assert.ok(product.offers?.availability, `${route.path} should expose lifecycle availability`);
    assert.equal(breadcrumb?.itemListElement?.length, 3, `${route.path} should expose three breadcrumb levels`);
  }

  const expectedCanonical = normalizeUrl(new URL(route.path, canonicalOrigin));
  assert.equal(metadata.title, route.title, `${route.path} should have its page title`);
  assert.ok(metadata.description, `${route.path} should have a description`);
  assert.equal(normalizeUrl(metadata.canonical), expectedCanonical, `${route.path} canonical should match its route`);
  assert.equal(normalizeUrl(metadata.openGraph.url), expectedCanonical, `${route.path} og:url should match its canonical`);
  assert.equal(metadata.openGraph.title, metadata.title, `${route.path} OG title should match its title`);
  assert.equal(metadata.openGraph.description, metadata.description, `${route.path} OG description should match`);
  assert.equal(metadata.openGraph.siteName, "Gonba's Garage", `${route.path} should identify the site`);
  assert.equal(metadata.openGraph.locale, 'es_AR', `${route.path} should use the Argentine locale`);
  assert.equal(metadata.openGraph.type, 'website', `${route.path} should use the website OG type`);
  assert.ok(metadata.openGraph.imageAlt, `${route.path} OG image should have alt text`);
  assert.equal(metadata.twitter.card, 'summary_large_image', `${route.path} should request a large Twitter card`);
  assert.equal(metadata.twitter.title, metadata.title, `${route.path} Twitter title should match`);
  assert.equal(metadata.twitter.description, metadata.description, `${route.path} Twitter description should match`);
  assert.equal(metadata.twitter.image, metadata.openGraph.image, `${route.path} should use the same social image`);
  assert.equal(metadata.twitter.imageAlt, metadata.openGraph.imageAlt, `${route.path} social image alt text should match`);

  if (indexingEnabled) {
    assert.match(metadata.robots || '', /index/, `${route.path} should be indexable`);
    assert.doesNotMatch(metadata.robots || '', /noindex/, `${route.path} should not emit noindex`);
  } else {
    assert.match(metadata.robots || '', /noindex/, `${route.path} should emit noindex in demo mode`);
    assert.match(metadata.robots || '', /nofollow/, `${route.path} should emit nofollow in demo mode`);
    assert.match(metadata.googleBot || '', /noindex/, `${route.path} should give Googlebot noindex`);
  }

  const imagePath = new URL(metadata.openGraph.image).pathname;
  const imageResponse = await fetch(new URL(imagePath, targetOrigin));
  assert.equal(imageResponse.status, 200, `${route.path} social image should return 200`);
  assert.match(
    imageResponse.headers.get('content-type') || '',
    /^image\//,
    `${route.path} social image should return an image content type`,
  );

  const imageBytes = Buffer.from(await imageResponse.arrayBuffer());

  if (!route.path.startsWith('/vehiculos/')) {
    assert.equal(imagePath, '/gonba-garage-social-preview.png', `${route.path} should use the branded default card`);
  }

  {
    assert.equal(imageResponse.headers.get('content-type'), 'image/png', `${route.path} generated social card should be PNG`);
    assert.equal(imageBytes.readUInt32BE(16), 1200, `${route.path} social card should be 1200px wide`);
    assert.equal(imageBytes.readUInt32BE(20), 630, `${route.path} social card should be 630px tall`);
  }

  results.push({
    route: route.path,
    canonical: metadata.canonical,
    image: metadata.openGraph.image,
  });
}

assert.equal(new Set(results.map(({ canonical }) => canonical)).size, routes.length, 'Canonicals should be unique');
const vehicleResults = results.filter(({ route }) => route.startsWith('/vehiculos/'));
assert.equal(
  new Set(vehicleResults.map(({ image }) => image)).size,
  vehicleResults.length,
  'Each vehicle should have a distinct social image',
);

const robotsResponse = await fetch(new URL('/robots.txt', targetOrigin));
assert.equal(robotsResponse.status, 200, 'robots.txt should return 200');
const robotsText = await robotsResponse.text();
assert.match(robotsText, /Allow: \/(?:\n|\r)/, 'robots.txt should allow crawlers to read noindex pages');
assert.match(robotsText, /Disallow: \/api\//, 'robots.txt should keep API routes out of crawl paths');

const sitemapResponse = await fetch(new URL('/sitemap.xml', targetOrigin));
assert.equal(sitemapResponse.status, 200, 'sitemap.xml should return 200');
const sitemapText = await sitemapResponse.text();

const manifestResponse = await fetch(new URL('/manifest.webmanifest', targetOrigin));
assert.equal(manifestResponse.status, 200, 'Web manifest should return 200');
assert.match(manifestResponse.headers.get('content-type') || '', /application\/manifest\+json/, 'Manifest should have its expected content type');
const manifest = await manifestResponse.json();
assert.equal(manifest.name, "Gonba's Garage", 'Manifest should use the brand name');
assert.ok(manifest.icons?.some((icon) => icon.src === '/favicon.svg'), 'Manifest should include the branded icon');

const faviconResponse = await fetch(new URL('/favicon.svg', targetOrigin));
assert.equal(faviconResponse.status, 200, 'Branded favicon should return 200');
assert.equal(faviconResponse.headers.get('content-type'), 'image/svg+xml', 'Favicon should be SVG');

const homeResponse = await fetch(targetOrigin);
const linkedAppleIcon = new URL(getMetadata(await homeResponse.text()).appleIcon, targetOrigin);
const localAppleIcon = new URL(`${linkedAppleIcon.pathname}${linkedAppleIcon.search}`, targetOrigin);
const appleIconResponse = await fetch(localAppleIcon);
assert.equal(appleIconResponse.status, 200, 'Apple touch icon should return 200');
assert.equal(appleIconResponse.headers.get('content-type'), 'image/png', 'Apple touch icon should be PNG');

if (indexingEnabled) {
  assert.match(robotsText, /Sitemap:/, 'Indexable mode should advertise the sitemap');
  assert.match(sitemapText, /<url>/, 'Indexable mode should publish sitemap URLs');
} else {
  assert.doesNotMatch(robotsText, /Sitemap:/, 'Demo mode should not advertise the sitemap');
  assert.doesNotMatch(sitemapText, /<url>/, 'Demo mode should serve an empty sitemap');
}

// The alert confirmation result page is a normal site page, but never indexable or in the sitemap.
for (const query of ['?estado=confirmada&tipo=precio&vehiculo=bmw-330i-m-sport-2021', '?estado=vencido', '']) {
  const response = await fetch(new URL(`/alertas/confirmacion${query}`, targetOrigin));
  assert.equal(response.status, 200);
  const metadata = getMetadata(await response.text());
  assert.equal(metadata.title, "Confirmación de alerta | Gonba's Garage");
  assert.match(metadata.robots || '', /noindex/, '/alertas/confirmacion must be noindex in every mode');
  assert.match(metadata.robots || '', /nofollow/);
  assert.equal(new URL(metadata.canonical).pathname, '/alertas/confirmacion', 'The canonical excludes the query');
  assert.equal(new URL(metadata.canonical).search, '');
}
// Catalog filters, sort and comparison live in the query string; they never create a canonical.
const filteredCatalog = await fetch(new URL('/vehiculos?marca=BMW&orden=recientes&comparar=bmw-330i-m-sport-2021', targetOrigin));
assert.equal(filteredCatalog.status, 200);
assert.equal(
  normalizeUrl(getMetadata(await filteredCatalog.text()).canonical),
  normalizeUrl(new URL('/vehiculos', canonicalOrigin)),
  'A filtered catalog URL must keep the /vehiculos canonical',
);

const alertSitemap = await (await fetch(new URL('/sitemap.xml', targetOrigin))).text();
assert.doesNotMatch(alertSitemap, /alertas/, 'Alert pages are excluded from the sitemap');

const missingResponse = await fetch(new URL('/this-page-does-not-exist', targetOrigin));
assert.equal(missingResponse.status, 404, 'Unknown pages should return 404');
assert.equal(
  getMetadata(await missingResponse.text()).canonical,
  undefined,
  'The 404 page should not claim the homepage canonical',
);

// The catalog-unavailable fallback must never hide a genuinely missing vehicle.
const missingVehicle = await fetch(new URL('/vehiculos/vehiculo-inexistente-2000', targetOrigin));
assert.equal(missingVehicle.status, 404, 'A missing vehicle should return 404');
assert.equal(getMetadata(await missingVehicle.text()).canonical, undefined, 'A missing vehicle should not claim a canonical URL');

// Cars that are no longer for sale keep their page, out of search results and listings. Mercado Libre
// paused reads as reserved for a while, then as sold; closed reads as sold (status.ts).
const catalogHtml = await (await fetch(new URL('/vehiculos', targetOrigin))).text();
const homeHtml = await (await fetch(targetOrigin)).text();
const lifecycleSitemap = await (await fetch(new URL('/sitemap.xml', targetOrigin))).text();
const activeDetail = await (await fetch(new URL('/vehiculos/bmw-330i-m-sport-2021', targetOrigin))).text();
assert.doesNotMatch(activeDetail, /id="similares"/, 'An available car does not show the similar-cars rail');
assert.match(activeDetail, /Consultar por este auto/, 'An available car keeps its contact action');
for (const fixture of [
  { path: '/vehiculos/bmw-m340i-xdrive-2022', label: 'Reservado', availability: 'https://schema.org/Reserved', reason: 'Está reservado' },
  { path: '/vehiculos/mercedes-benz-280-sl-1969', label: 'Vendido', availability: 'https://schema.org/SoldOut', reason: 'Ya se vendió' },
  { path: '/vehiculos/porsche-911-sc-1980', label: 'Vendido', availability: 'https://schema.org/SoldOut', reason: 'Ya se vendió' },
]) {
  const response = await fetch(new URL(fixture.path, targetOrigin));
  assert.equal(response.status, 200, `${fixture.path} keeps its page`);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  const html = await response.text();
  const metadata = getMetadata(html);
  const label = decodeHtml(html.match(/class="detail-availability"[^>]*><span><\/span> ?(?:<!-- -->)?([^<]*)</)?.[1] ?? '');
  const offer = getJsonLd(html).flatMap((entry) => entry['@graph'] || [])
    .find((entry) => Array.isArray(entry['@type']) && entry['@type'].includes('Product'))?.offers;
  assert.equal(label, fixture.label, `${fixture.path} label`);
  assert.equal(offer?.availability, fixture.availability, `${fixture.path} Offer availability`);
  assert.ok(offer?.price > 0, `${fixture.path} Offer keeps the price shown on the page`);
  assert.ok(metadata.description.includes(fixture.reason), `${fixture.path} description states the status`);
  assert.doesNotMatch(metadata.description, /Consultá disponibilidad/, `${fixture.path} must not imply availability`);
  assert.equal(metadata.openGraph.description, metadata.description);
  assert.equal(metadata.twitter.description, metadata.description);
  assert.equal(new URL(metadata.canonical).pathname, fixture.path, `${fixture.path} keeps its canonical`);
  if (indexingEnabled) {
    assert.match(metadata.robots || '', /noindex/, `${fixture.path} stays out of search results`);
    assert.doesNotMatch(metadata.robots || '', /nofollow/, `${fixture.path} links to available cars are followed`);
  } else {
    assert.match(metadata.robots || '', /noindex/);
    assert.match(metadata.robots || '', /nofollow/);
  }
  assert.doesNotMatch(html, /Consultar por este auto|comparar=|Ver publicación en Mercado Libre/, `${fixture.path} must not offer the car`);
  // The email alert is offered only where alert emails can be sent; otherwise WhatsApp is.
  const statusCard = decodeHtml(html.slice(html.indexOf('detail-status-title'), html.indexOf('detail-disclaimer')).replace(/<[^>]+>/g, ''));
  if (alertsEnabled) {
    assert.match(statusCard, /dejanos tu email/, `${fixture.path} offers the email alert`);
    assert.match(html, /class="detail-alert-card"/, `${fixture.path} shows the alert card`);
  } else {
    assert.doesNotMatch(statusCard, /email/i, `${fixture.path} promises no email`);
    assert.doesNotMatch(html, /class="detail-alert-card"|inventory-alert-dialog/, `${fixture.path} offers no alert`);
    assert.match(statusCard, /escribinos por WhatsApp/, `${fixture.path} points to WhatsApp instead`);
    assert.match(html, /href="https:\/\/wa\.me\/[^"]*"[^>]*>(?:Avisame por WhatsApp|Contanos qué buscás)/, `${fixture.path} links WhatsApp`);
  }
  assert.match(html, /id="similares"/, `${fixture.path} shows available alternatives`);
  const railLinks = [...html.slice(html.indexOf('id="similares"')).matchAll(/<a\b[^>]*class="catalog-card-image-link"[^>]*>/g)]
    .map(([tag]) => getAttributes(tag).href);
  assert.ok(railLinks.length > 0 && railLinks.length <= 3, `${fixture.path} rail shows up to three cars`);
  assert.ok(!railLinks.includes(fixture.path), `${fixture.path} rail never suggests the car itself`);
  assert.ok(!html.slice(html.indexOf('id="similares"')).match(/data-status="(?!active)/), `${fixture.path} rail only suggests available cars`);
  for (const listing of [catalogHtml, homeHtml, lifecycleSitemap]) {
    assert.ok(!listing.includes(fixture.path), `${fixture.path} is not listed`);
  }
  const image = await fetch(new URL(new URL(metadata.openGraph.image).pathname, targetOrigin));
  assert.equal(image.status, 200, `${fixture.path} social card`);
  const imageBytes = Buffer.from(await image.arrayBuffer());
  assert.equal(imageBytes.readUInt32BE(16), 1200);
  assert.equal(imageBytes.readUInt32BE(20), 630);
}

// The legal pages are public and indexable, linked from every footer and from both alert forms.
const legalPaths = ['/privacidad', '/terminos'];
const visibleText = (html) => decodeHtml((html.match(/<main\b[\s\S]*<\/main>/)?.[0] ?? '').replace(/<[^>]+>/g, ''));
for (const path of legalPaths) {
  if (indexingEnabled) {
    assert.ok(lifecycleSitemap.includes(`<loc>${new URL(path, canonicalOrigin)}</loc>`), `${path} is in the sitemap`);
  }
  const html = await (await fetch(new URL(path, targetOrigin))).text();
  const text = visibleText(html);
  // The owner's identity is published, never a placeholder.
  assert.match(text, /CUIT \d{2}-\d{8}-\d/, `${path} identifies the owner`);
  assert.doesNotMatch(text, /\b(?:TODO|TBD|placeholder)\b|\[[^\]]*\]/i, `${path} has no placeholders`);
  assert.match(html, /<time dateTime="\d{4}-\d{2}-\d{2}">/i, `${path} shows its last update`);
}
const privacyHtml = await (await fetch(new URL('/privacidad', targetOrigin))).text();
for (const required of ['Ley 25.326', 'Agencia de Acceso a la Información Pública', 'PostHog', 'Resend', 'Neon', 'Vercel', 'Cancelar alerta']) {
  assert.ok(visibleText(privacyHtml).includes(required), `/privacidad mentions ${required}`);
}
for (const [label, html] of [['Home', homeHtml], ['Catalog', catalogHtml], ['Vehicle', activeDetail], ['/privacidad', privacyHtml]]) {
  const footer = html.match(/<footer\b[\s\S]*<\/footer>/)?.[0] ?? '';
  for (const path of legalPaths) assert.ok(footer.includes(`href="${path}"`), `${label} footer links ${path}`);
}
// Each alert form is offered only where alert emails can be sent, and then states that subscribing
// accepts the privacy policy (price on detail, search on catalog).
for (const [label, html, enabled] of [['Price alert', activeDetail, alertsEnabled], ['Inventory alert', catalogHtml, alertsEnabled]]) {
  if (enabled) {
    assert.match(html, /class="price-alert-privacy">[^<]*Al suscribirte aceptás la (?:<!-- -->)?<a [^>]*href="\/privacidad"/, `${label} links the privacy policy`);
  } else {
    assert.doesNotMatch(html, /price-alert-dialog|price-alert-privacy|detail-alert-card|inventory-alert-trigger/, `${label} is not offered without the email configuration`);
  }
}

console.table(results);
console.log(
  `\nSocial metadata and ${indexingEnabled ? 'production' : 'demo'} indexing verification passed for ${routes.length} public routes`
    + ` (alert emails ${alertsEnabled ? 'configured' : 'not configured'}).`,
);
