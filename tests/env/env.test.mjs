import assert from 'node:assert/strict';
import { beforeEach, describe, it, vi } from 'vitest';
import {
  alertEmailEnv,
  argAutosEnv,
  cronEnv,
  databaseEnv,
  mercadoLibreEnv,
  misconfiguredFeatures,
  requireMercadoLibreEnv,
  reviewEnv,
  siteEnv,
} from '@/lib/env';
import { IntegrationFailure } from '@/lib/integrations/mercado-libre/failures';
import { runtimeImports } from '../helpers/modules.mjs';

const variables = [
  'DATABASE_URL',
  'MERCADO_LIBRE_CLIENT_ID',
  'MERCADO_LIBRE_CLIENT_SECRET',
  'MERCADO_LIBRE_REDIRECT_URI',
  'MERCADO_LIBRE_SELLER_ID',
  'MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY',
  'MERCADO_LIBRE_CATALOG_API_KEY',
  'MERCADO_LIBRE_BACKEND_URL',
  'MERCADO_LIBRE_WEBHOOK_IPS',
  'RESEND_API_KEY',
  'ALERTS_EMAIL_FROM',
  'ALERTS_PUBLIC_URL',
  'ALERTS_SIGNING_SECRET',
  'ALERTS_TEST_RECIPIENT',
  'REVIEWS_NOTIFICATION_EMAIL',
  'INTEGRATION_ALERT_EMAIL',
  'INTEGRATION_HEARTBEAT_URL',
  'CRON_SECRET',
  'SITE_INDEXING_ENABLED',
  'ARGAUTOS_API_KEY',
];
const secret = 'secret-value-that-must-never-be-logged-0123456789';
const stub = values => {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
};

const mercadoLibre = {
  MERCADO_LIBRE_CLIENT_ID: '1234',
  MERCADO_LIBRE_CLIENT_SECRET: secret,
  MERCADO_LIBRE_REDIRECT_URI: 'https://example.test/callback',
  MERCADO_LIBRE_SELLER_ID: '123',
  MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};
const alertEmail = {
  DATABASE_URL: 'postgres://example.test/db',
  RESEND_API_KEY: secret,
  ALERTS_EMAIL_FROM: 'Gonba <alertas@example.test>',
  ALERTS_PUBLIC_URL: 'https://example.test',
  ALERTS_SIGNING_SECRET: secret,
};

// Each test starts from an empty environment, whatever the shell running the tests has set.
beforeEach(() => {
  for (const name of variables) vi.stubEnv(name, undefined);
});

describe('server environment', () => {
  it('loads nothing but the safe failure it reports', () => {
    for (const id of runtimeImports('lib/env.ts'))
      assert.ok(['server-only', '@/lib/integrations/mercado-libre/failures'].includes(id), id);
  });

  it('reads each value when it is used, not at import', () => {
    assert.equal(databaseEnv.url(), undefined);
    vi.stubEnv('DATABASE_URL', 'postgres://example.test/db');
    assert.equal(databaseEnv.url(), 'postgres://example.test/db');
  });

  it('trims Mercado Libre values and treats blank as unset', () => {
    stub({
      MERCADO_LIBRE_SELLER_ID: ' 123 \n',
      MERCADO_LIBRE_CLIENT_ID: '   ',
      MERCADO_LIBRE_WEBHOOK_IPS: ' 1.2.3.4, ,5.6.7.8 ',
    });
    assert.equal(mercadoLibreEnv.sellerId(), '123');
    assert.equal(mercadoLibreEnv.clientId(), undefined);
    assert.deepEqual(mercadoLibreEnv.webhookIps(), ['1.2.3.4', '5.6.7.8']);
    vi.stubEnv('MERCADO_LIBRE_WEBHOOK_IPS', undefined);
    assert.deepEqual(mercadoLibreEnv.webhookIps(), []);
  });

  it('fails a required Mercado Libre setting with the safe configuration incident', () => {
    assert.throws(
      () => requireMercadoLibreEnv('clientSecret'),
      error =>
        error instanceof IntegrationFailure &&
        error.incident.stage === 'configuration' &&
        error.incident.code === 'missing_configuration' &&
        !JSON.stringify(error.incident).includes('MERCADO_LIBRE'),
    );
    vi.stubEnv('MERCADO_LIBRE_CLIENT_SECRET', ` ${secret} `);
    assert.equal(requireMercadoLibreEnv('clientSecret'), secret);
  });

  // The signing secret keys hashes and signed links, so even surrounding spaces are kept.
  it('keeps secrets exactly as set and treats short ones as unset', () => {
    stub({ ALERTS_SIGNING_SECRET: ` ${secret}`, CRON_SECRET: 'too-short' });
    assert.equal(alertEmailEnv.signingSecret(), ` ${secret}`);
    assert.equal(cronEnv.secret(), undefined);
    stub({ ALERTS_SIGNING_SECRET: 'x'.repeat(31), CRON_SECRET: 'y'.repeat(32) });
    assert.equal(alertEmailEnv.signingSecret(), undefined);
    assert.equal(cronEnv.secret(), 'y'.repeat(32));
  });

  it('accepts only a bare HTTPS origin for alert links', () => {
    assert.equal(alertEmailEnv.publicOrigin(), undefined);
    for (const url of [
      'http://example.test',
      'https://example.test/path',
      'https://user@example.test',
      'https://example.test/?a=1',
      'https://example.test/#top',
      'not a url',
    ]) {
      vi.stubEnv('ALERTS_PUBLIC_URL', url);
      assert.equal(alertEmailEnv.publicOrigin(), undefined, url);
    }
    vi.stubEnv('ALERTS_PUBLIC_URL', 'https://Example.test/');
    assert.equal(alertEmailEnv.publicOrigin(), 'https://example.test');
  });

  it('enables indexing only for exactly "true"', () => {
    for (const value of [undefined, 'false', 'TRUE', '1']) {
      vi.stubEnv('SITE_INDEXING_ENABLED', value);
      assert.equal(siteEnv.indexingEnabled(), false, value);
    }
    vi.stubEnv('SITE_INDEXING_ENABLED', 'true');
    assert.equal(siteEnv.indexingEnabled(), true);
  });

  it('reads the optional Arg Autos key', () => {
    assert.equal(argAutosEnv.apiKey(), undefined);
    vi.stubEnv('ARGAUTOS_API_KEY', ' key ');
    assert.equal(argAutosEnv.apiKey(), 'key');
  });
});

describe('misconfigured features', () => {
  it('lists nothing when every optional feature is off or complete', () => {
    assert.deepEqual(misconfiguredFeatures(), []);
    stub({
      ...mercadoLibre,
      ...alertEmail,
      MERCADO_LIBRE_CATALOG_API_KEY: secret,
      CRON_SECRET: secret,
      SITE_INDEXING_ENABLED: 'false',
    });
    assert.deepEqual(misconfiguredFeatures(), []);
  });

  // Previews and local runs: the database and the rate-limit secret without alert emails, or only
  // the deployed backend's catalog.
  it('does not flag the intentional partial setups', () => {
    stub({ DATABASE_URL: 'postgres://example.test/db', ALERTS_SIGNING_SECRET: secret });
    assert.deepEqual(misconfiguredFeatures(), []);
    stub({ MERCADO_LIBRE_BACKEND_URL: 'https://backend.example.test', MERCADO_LIBRE_CATALOG_API_KEY: secret });
    assert.deepEqual(misconfiguredFeatures(), []);
  });

  it('names the missing or invalid variables of a half set-up group, never their values', () => {
    stub({
      ...mercadoLibre,
      MERCADO_LIBRE_REDIRECT_URI: undefined,
      MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY: 'c2hvcnQ=',
      ...alertEmail,
      ALERTS_PUBLIC_URL: 'http://example.test',
      ALERTS_SIGNING_SECRET: undefined,
      MERCADO_LIBRE_BACKEND_URL: 'http://backend.example.test',
      CRON_SECRET: 'short',
      SITE_INDEXING_ENABLED: 'yes',
    });
    const problems = misconfiguredFeatures();
    assert.deepEqual(problems, [
      { feature: 'mercado_libre', variables: ['MERCADO_LIBRE_REDIRECT_URI', 'MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY'] },
      { feature: 'mercado_libre_backend', variables: ['MERCADO_LIBRE_BACKEND_URL', 'MERCADO_LIBRE_CATALOG_API_KEY'] },
      { feature: 'alert_email', variables: ['ALERTS_PUBLIC_URL', 'ALERTS_SIGNING_SECRET'] },
      { feature: 'cron', variables: ['CRON_SECRET'] },
      { feature: 'site', variables: ['SITE_INDEXING_ENABLED'] },
    ]);
    assert.equal(JSON.stringify(problems).includes(secret), false);
  });

  it('flags alert emails set up without the database', () => {
    stub({ ...alertEmail, DATABASE_URL: undefined });
    assert.deepEqual(misconfiguredFeatures(), [{ feature: 'alert_email', variables: ['DATABASE_URL'] }]);
  });
});

describe('the review notification address', () => {
  const complete = {
    RESEND_API_KEY: secret,
    ALERTS_EMAIL_FROM: 'Gonba <alertas@example.test>',
    ALERTS_PUBLIC_URL: 'https://example.test',
    ALERTS_SIGNING_SECRET: secret,
  };

  it('is read trimmed, and unset means nobody is told', () => {
    vi.stubEnv('REVIEWS_NOTIFICATION_EMAIL', ' avisos@example.test ');
    assert.equal(reviewEnv.notificationEmail(), 'avisos@example.test');
    vi.stubEnv('REVIEWS_NOTIFICATION_EMAIL', '');
    assert.equal(reviewEnv.notificationEmail(), undefined);
  });

  it('is reported when the emails it depends on cannot be sent', () => {
    vi.stubEnv('REVIEWS_NOTIFICATION_EMAIL', 'avisos@example.test');
    assert.deepEqual(
      misconfiguredFeatures().find(({ feature }) => feature === 'review_email')?.variables,
      Object.keys(complete),
    );
    stub(complete);
    assert.equal(
      misconfiguredFeatures().some(({ feature }) => feature === 'review_email'),
      false,
    );
  });
});
