import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isAnalyticsHost, removeSearchText } from '@/lib/analytics/privacy';

const siteUrl = new URL('https://gonbagarage.com.ar');

describe('isAnalyticsHost', () => {
  it('accepts only the canonical host', () => {
    assert.equal(isAnalyticsHost('gonbagarage.com.ar', siteUrl), true);
    assert.equal(isAnalyticsHost('gonba-garage.vercel.app', siteUrl), false);
    assert.equal(isAnalyticsHost('gonba-garage-git-feature-team.vercel.app', siteUrl), false);
    assert.equal(isAnalyticsHost('www.gonbagarage.com.ar', siteUrl), false);
  });
});

describe('removeSearchText', () => {
  it('drops the typed search from every URL property and keeps the filters', () => {
    const event = removeSearchText({
      uuid: '1',
      event: '$pageview',
      properties: {
        $current_url: 'https://gonbagarage.com.ar/vehiculos?q=%3CMASKED%3E&marca=Toyota',
        $referrer: 'https://gonbagarage.com.ar/vehiculos?q=hilux+de+juan&orden=anio',
        $pathname: '/vehiculos',
        $referring_domain: 'gonbagarage.com.ar',
        search_length: 12,
      },
      $set: { $current_url: 'https://gonbagarage.com.ar/vehiculos?q=sw4' },
      $set_once: { $initial_referrer: 'https://gonbagarage.com.ar/vehiculos?q=sw4#top' },
    });

    assert.equal(event.properties.$current_url, 'https://gonbagarage.com.ar/vehiculos?marca=Toyota');
    assert.equal(event.properties.$referrer, 'https://gonbagarage.com.ar/vehiculos?orden=anio');
    assert.equal(event.properties.$pathname, '/vehiculos');
    assert.equal(event.properties.$referring_domain, 'gonbagarage.com.ar');
    assert.equal(event.properties.search_length, 12);
    assert.equal(event.$set.$current_url, 'https://gonbagarage.com.ar/vehiculos');
    assert.equal(event.$set_once.$initial_referrer, 'https://gonbagarage.com.ar/vehiculos#top');
  });

  it('leaves URLs without a search and non-URL values untouched', () => {
    const properties = {
      $current_url: 'https://gonbagarage.com.ar/vehiculos?marca=Ford',
      $referrer: '$direct',
      q: 'not a url',
    };
    const event = removeSearchText({ uuid: '2', event: '$pageview', properties });

    assert.deepEqual(event.properties, properties);
    assert.equal(removeSearchText(null), null);
  });
});
