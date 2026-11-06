import { startAnalytics } from '@/lib/analytics/client';
import { isAnalyticsHost, removeSearchText, SEARCH_TEXT_PARAM } from '@/lib/analytics/privacy';
import { getSiteUrl } from '@/lib/site-url';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (projectToken && isAnalyticsHost(window.location.hostname, getSiteUrl())) {
  // posthog-js is the largest client chunk, so it loads after the page instead of before hydration.
  startAnalytics(async () => {
    const { default: posthog } = await import('posthog-js');
    posthog.init(projectToken, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      // Real visitors' LCP, CLS, FCP and INP as $web_vitals. Reads the browser's buffered entries, so
      // loading late still sees the page's first paints.
      capture_performance: { web_vitals: true },
      // The catalog keeps its search text in the URL (?q=), which stays out of analytics. The first
      // option is what turns the second on; it also masks ad click IDs such as gclid, never utm_*.
      mask_personal_data_properties: true,
      custom_personal_data_properties: [SEARCH_TEXT_PARAM],
      before_send: removeSearchText,
      // The site runs no surveys; this skips the extra script PostHog would fetch for them.
      disable_surveys: true,
      disable_session_recording: process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY !== 'true',
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-private]',
      },
    });
    return posthog;
  });
}
