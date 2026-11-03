import 'server-only';
import { failure } from '@/lib/integrations/mercado-libre/failures';

// The server environment, grouped by feature. Values are read when they are used, never at import,
// and each feature checks only its own group when it runs: the database, alert emails, the local
// catalog backend and Arg Autos are optional, and builds run without database credentials.
// `misconfiguredFeatures` lists the groups that are only half set up (instrumentation.ts logs them).
// NEXT_PUBLIC_* values are not here: the build inlines them, also into client code.

/** As set; unset and empty are both undefined. Secrets that sign or key hashes are never trimmed. */
function exact(name: string) {
  return process.env[name] || undefined;
}

/** Trimmed; unset, empty and blank are all undefined. */
function trimmed(name: string) {
  return process.env[name]?.trim() || undefined;
}

/** A secret shorter than 32 characters counts as unset. */
function longSecret(value: string | undefined) {
  return value && value.length >= 32 ? value : undefined;
}

/** Neon PostgreSQL, the one database (lib/database.ts). */
export const databaseEnv = {
  url: () => exact('DATABASE_URL'),
};

/** Mercado Libre OAuth application, seller, credential storage, catalog endpoints and webhook. */
export const mercadoLibreEnv = {
  clientId: () => trimmed('MERCADO_LIBRE_CLIENT_ID'),
  clientSecret: () => trimmed('MERCADO_LIBRE_CLIENT_SECRET'),
  redirectUri: () => trimmed('MERCADO_LIBRE_REDIRECT_URI'),
  sellerId: () => trimmed('MERCADO_LIBRE_SELLER_ID'),
  /** Base64 AES-256 key for the stored tokens; credentials.ts checks its length. */
  tokenEncryptionKey: () => trimmed('MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY'),
  /** Guards the private catalog and diagnostics endpoints, and authorizes a local server's reads. */
  catalogApiKey: () => trimmed('MERCADO_LIBRE_CATALOG_API_KEY'),
  /** Local development only: the deployed backend whose synced catalog this server reads. */
  backendUrl: () => trimmed('MERCADO_LIBRE_BACKEND_URL'),
  /** Addresses Mercado Libre sends notifications from. Empty when unset. */
  webhookIps: () =>
    (process.env.MERCADO_LIBRE_WEBHOOK_IPS ?? '')
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean),
};

type MercadoLibreSetting = Exclude<keyof typeof mercadoLibreEnv, 'webhookIps'>;

/** A setting the Mercado Libre operation cannot run without. Unset, it fails with the safe configuration incident. */
export function requireMercadoLibreEnv(setting: MercadoLibreSetting) {
  const value = mercadoLibreEnv[setting]();
  if (!value) throw failure('configuration', 'missing_configuration');
  return value;
}

/**
 * Alert emails (price and search alerts) through Resend. lib/alerts/config.ts decides whether the
 * whole group, plus the database, is complete; alerts are offered only then.
 */
export const alertEmailEnv = {
  resendApiKey: () => exact('RESEND_API_KEY'),
  from: () => exact('ALERTS_EMAIL_FROM'),
  /** The bare HTTPS origin of ALERTS_PUBLIC_URL, or undefined when it is unset or anything else. */
  publicOrigin: () => {
    const url = URL.parse(exact('ALERTS_PUBLIC_URL') ?? '');
    return url &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/'
      ? url.origin
      : undefined;
  },
  /** Signs confirmation and cancellation links and keys the hashed rate limits. */
  signingSecret: () => longSecret(exact('ALERTS_SIGNING_SECRET')),
  /** Preview and local tests: the only address emails may go to. */
  testRecipient: () => exact('ALERTS_TEST_RECIPIENT'),
};

/** The Vercel crons: daily alerts and the Mercado Libre catalog reconciliation. */
export const cronEnv = {
  secret: () => longSecret(exact('CRON_SECRET')),
};

/** Site-wide switches read by the server. */
export const siteEnv = {
  /** Search engines may index the site only when this is exactly "true" (docs/seo-and-social-metadata.md). */
  indexingEnabled: () => process.env.SITE_INDEXING_ENABLED === 'true',
};

/** The Arg Autos vehicle catalog behind the sell-your-car form. Anonymous access has a low rate limit. */
export const argAutosEnv = {
  apiKey: () => trimmed('ARGAUTOS_API_KEY'),
};

export type MisconfiguredFeature = { feature: string; variables: string[] };

function isSet(name: string) {
  return Boolean(process.env[name]?.trim());
}

/**
 * Feature groups that are switched on (one of their `trigger` variables is set) but cannot work,
 * with the variables that are missing or invalid. A group left entirely unset is off on purpose
 * and is not listed. Only variable names are reported, never values.
 */
export function misconfiguredFeatures() {
  const groups: Array<{ feature: string; trigger: string[]; usable: Record<string, boolean> }> = [
    {
      feature: 'mercado_libre',
      trigger: [
        'MERCADO_LIBRE_CLIENT_ID',
        'MERCADO_LIBRE_CLIENT_SECRET',
        'MERCADO_LIBRE_REDIRECT_URI',
        'MERCADO_LIBRE_SELLER_ID',
        'MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY',
      ],
      usable: {
        MERCADO_LIBRE_CLIENT_ID: !!mercadoLibreEnv.clientId(),
        MERCADO_LIBRE_CLIENT_SECRET: !!mercadoLibreEnv.clientSecret(),
        MERCADO_LIBRE_REDIRECT_URI: !!mercadoLibreEnv.redirectUri(),
        MERCADO_LIBRE_SELLER_ID: /^\d+$/.test(mercadoLibreEnv.sellerId() ?? ''),
        MERCADO_LIBRE_TOKEN_ENCRYPTION_KEY:
          Buffer.from(mercadoLibreEnv.tokenEncryptionKey() ?? '', 'base64').length === 32,
      },
    },
    {
      feature: 'mercado_libre_backend',
      trigger: ['MERCADO_LIBRE_BACKEND_URL'],
      usable: {
        MERCADO_LIBRE_BACKEND_URL: URL.parse(mercadoLibreEnv.backendUrl() ?? '')?.protocol === 'https:',
        MERCADO_LIBRE_CATALOG_API_KEY: !!mercadoLibreEnv.catalogApiKey(),
      },
    },
    {
      // ALERTS_SIGNING_SECRET alone is not a trigger: it also keys the rate limits wherever the
      // database is set, with alert emails off.
      feature: 'alert_email',
      trigger: ['RESEND_API_KEY', 'ALERTS_EMAIL_FROM', 'ALERTS_PUBLIC_URL'],
      usable: {
        DATABASE_URL: !!databaseEnv.url(),
        RESEND_API_KEY: !!alertEmailEnv.resendApiKey(),
        ALERTS_EMAIL_FROM: !!alertEmailEnv.from(),
        ALERTS_PUBLIC_URL: !!alertEmailEnv.publicOrigin(),
        ALERTS_SIGNING_SECRET: !!alertEmailEnv.signingSecret(),
      },
    },
    { feature: 'cron', trigger: ['CRON_SECRET'], usable: { CRON_SECRET: !!cronEnv.secret() } },
    {
      feature: 'site',
      trigger: ['SITE_INDEXING_ENABLED'],
      usable: { SITE_INDEXING_ENABLED: ['true', 'false'].includes(process.env.SITE_INDEXING_ENABLED ?? '') },
    },
  ];
  return groups.flatMap(({ feature, trigger, usable }): MisconfiguredFeature[] => {
    const variables = Object.keys(usable).filter(name => !usable[name]);
    return trigger.some(isSet) && variables.length ? [{ feature, variables }] : [];
  });
}
