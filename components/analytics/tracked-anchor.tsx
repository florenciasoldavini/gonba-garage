'use client';

import type { ComponentProps } from 'react';

import { ButtonAnchor } from '@/components/ui/button';
import { captureAnalyticsEvent, type AnalyticsEvent } from '@/lib/analytics/client';

// Server components cannot pass an onClick, so they pass the event as data. The link stays a real
// anchor: without JavaScript it still opens, it just goes unreported.
type TrackedProps<Props> = Omit<Props, 'onClick'> & { analyticsEvent: AnalyticsEvent };

export function TrackedAnchor({ analyticsEvent, ...props }: TrackedProps<ComponentProps<'a'>>) {
  return <a {...props} onClick={() => captureAnalyticsEvent(analyticsEvent.name, analyticsEvent.properties)} />;
}

export function TrackedButtonAnchor({ analyticsEvent, ...props }: TrackedProps<ComponentProps<typeof ButtonAnchor>>) {
  return <ButtonAnchor {...props} onClick={() => captureAnalyticsEvent(analyticsEvent.name, analyticsEvent.properties)} />;
}
