import type { BeforeSendFn, Properties } from 'posthog-js';

/** The catalog keeps the visitor's typed search in `?q=`, which the privacy policy promises not to record. */
export const SEARCH_TEXT_PARAM = 'q';

/**
 * Analytics runs only on the canonical host, so the `*.vercel.app` alias and preview deployments
 * never mix into production data.
 */
export function isAnalyticsHost(hostname: string, siteUrl: URL) {
  return hostname === siteUrl.hostname;
}

function withoutSearchText(value: unknown) {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) return value;

  try {
    const url = new URL(value);
    if (!url.searchParams.has(SEARCH_TEXT_PARAM)) return value;
    url.searchParams.delete(SEARCH_TEXT_PARAM);
    return url.toString();
  } catch {
    return value;
  }
}

function scrub(properties: Properties | undefined) {
  if (!properties) return properties;
  return Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, withoutSearchText(value)]));
}

/**
 * Removes the search text from every URL an event carries. PostHog's `custom_personal_data_properties`
 * masks `$current_url` and its copies but not `$referrer`, which is the catalog page, search included,
 * when a visitor opens a car from it in a new tab.
 */
export const removeSearchText: BeforeSendFn = (event) => {
  if (!event) return event;

  return {
    ...event,
    properties: scrub(event.properties) ?? event.properties,
    $set: scrub(event.$set),
    $set_once: scrub(event.$set_once),
  };
};
