import { startAnalytics } from '@/lib/analytics/client';

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (projectToken) {
  // posthog-js is the largest client chunk, so it loads after the page instead of before hydration.
  startAnalytics(async () => {
    const { default: posthog } = await import('posthog-js');
    posthog.init(projectToken, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
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
