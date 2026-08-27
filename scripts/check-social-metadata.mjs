import assert from 'node:assert/strict';

const targetOrigin = new URL(process.argv[2] || 'http://localhost:3100');
const indexingEnabled = process.env.SITE_INDEXING_ENABLED === 'true';

const routes = [
  { path: '/', title: "Gonba's Garage | Autos usados seleccionados" },
  { path: '/vehiculos', title: "Vehículos disponibles | Gonba's Garage" },
  { path: '/vender', title: "Vendé tu auto | Gonba's Garage" },
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
    assert.ok(siteGraph.some((entry) => entry['@type'] === 'AutoDealer'), 'Home should describe the business');
    assert.ok(metadata.icon, 'Home should link the branded favicon');
    assert.ok(metadata.appleIcon, 'Home should link the Apple touch icon');
    assert.ok(metadata.manifest, 'Home should link the web manifest');
  }

  if (route.path === '/vehiculos') {
    assert.doesNotMatch(
      response.headers.get('cache-control') || '',
      /no-store|private/,
      'Inventory should remain statically cacheable',
    );
  }

  if (route.path.startsWith('/vehiculos/')) {
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

  if (route.path.startsWith('/vehiculos/')) {
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
assert.equal(
  new Set(results.slice(3).map(({ image }) => image)).size,
  routes.length - 3,
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

const missingResponse = await fetch(new URL('/this-page-does-not-exist', targetOrigin));
assert.equal(missingResponse.status, 404, 'Unknown pages should return 404');
assert.equal(
  getMetadata(await missingResponse.text()).canonical,
  undefined,
  'The 404 page should not claim the homepage canonical',
);

console.table(results);
console.log(
  `\nSocial metadata and ${indexingEnabled ? 'production' : 'demo'} indexing verification passed for ${routes.length} public routes.`,
);
