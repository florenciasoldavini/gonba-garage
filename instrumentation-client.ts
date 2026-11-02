import posthog from 'posthog-js';

import { isAnalyticsHost, removeSearchText, SEARCH_TEXT_PARAM } from '@/lib/analytics/privacy';
import { getSiteUrl } from '@/lib/site-url';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (projectToken && isAnalyticsHost(window.location.hostname, getSiteUrl())) {
  posthog.init(projectToken, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    // Also masks the search text in heatmap URLs, which `before_send` doesn't see as plain properties.
    mask_personal_data_properties: true,
    custom_personal_data_properties: [SEARCH_TEXT_PARAM],
    before_send: removeSearchText,
    disable_session_recording:
      process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY !== 'true',
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-private]',
    },
  });
}
