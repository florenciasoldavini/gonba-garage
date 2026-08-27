'use client';

import posthog from 'posthog-js';

type AnalyticsEventProperties = {
  contact_intent_clicked: {
    channel: 'email' | 'whatsapp' | 'internal';
    placement: string;
    vehicle_slug?: string;
  };
  inventory_filtered: {
    active_filter_count: number;
    body_type: string;
    fuel: string;
    make: string;
    max_mileage: number;
    max_price: number;
    min_mileage: number;
    min_price: number;
    result_count: number;
    search_length: number;
    search_used: boolean;
    sort: string;
    transmission: string;
  };
  inventory_zero_results: {
    active_filter_count: number;
    body_type: string;
    fuel: string;
    make: string;
    search_used: boolean;
    transmission: string;
  };
  comparison_vehicle_added: { vehicle_slug: string; selection_count: number };
  comparison_vehicle_removed: { vehicle_slug: string; selection_count: number };
  comparison_opened: { vehicle_slugs: string[]; vehicle_count: number };
  vehicle_viewed: {
    body_type: string;
    currency: string;
    make: string;
    model: string;
    price: number;
    vehicle_slug: string;
    year: number;
  };
  vehicle_shared: { method: 'clipboard' | 'email' | 'whatsapp'; vehicle_slug: string };
  price_alert_opened: { vehicle_slug: string };
  price_alert_created: { vehicle_slug: string };
  price_alert_failed: { vehicle_slug: string };
  valuation_started: Record<string, never>;
  valuation_step_completed: { step: number };
  valuation_demo_completed: { total_steps: number };
};

export function captureAnalyticsEvent<EventName extends keyof AnalyticsEventProperties>(
  eventName: EventName,
  properties: AnalyticsEventProperties[EventName],
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  posthog.capture(eventName, properties);
}
