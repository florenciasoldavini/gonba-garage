import assert from 'node:assert/strict';

const targetOrigin = new URL(process.argv[2] || 'http://localhost:3100');

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

  const metadata = getMetadata(await response.text());

  if (route.path === '/') {
    assert.ok(metadata.canonical, 'Home should define a canonical URL');
    canonicalOrigin = new URL(metadata.canonical).origin;
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

  const imagePath = new URL(metadata.openGraph.image).pathname;
  const imageResponse = await fetch(new URL(imagePath, targetOrigin));
  assert.equal(imageResponse.status, 200, `${route.path} social image should return 200`);
  assert.match(
    imageResponse.headers.get('content-type') || '',
    /^image\//,
    `${route.path} social image should return an image content type`,
  );

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

const missingResponse = await fetch(new URL('/this-page-does-not-exist', targetOrigin));
assert.equal(missingResponse.status, 404, 'Unknown pages should return 404');
assert.equal(
  getMetadata(await missingResponse.text()).canonical,
  undefined,
  'The 404 page should not claim the homepage canonical',
);

console.table(results);
console.log(`\nSocial metadata verification passed for ${routes.length} public routes.`);
