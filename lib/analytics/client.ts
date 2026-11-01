'use client';

import posthog from 'posthog-js';

/** Catalog toolbar, catalog empty state, or the page of a car that is no longer for sale. */
type InventoryAlertPlacement = 'toolbar' | 'empty' | 'vehicle';

/** General contact actions. Vehicle pages report `vehicle_contact_clicked` instead. */
type ContactPlacement = 'header' | 'menu' | 'footer' | 'home_contact' | 'catalog_contact';

type AnalyticsEventProperties = {
  contact_intent_clicked: {
    channel: 'email' | 'whatsapp' | 'internal';
    placement: ContactPlacement;
  };
  vehicle_contact_clicked: {
    channel: 'whatsapp';
    /** The purchase card's main button, or the contact section at the end of the page. */
    placement: 'hero' | 'callout';
    vehicle_slug: string;
    vehicle_status: 'available' | 'reserved' | 'sold';
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
  inventory_alert_opened: { active_filter_count: number; placement: InventoryAlertPlacement; result_count: number };
  inventory_alert_created: { active_filter_count: number; placement: InventoryAlertPlacement; result_count: number };
  inventory_alert_failed: { active_filter_count: number; placement: InventoryAlertPlacement };
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
  vehicle_shared: { method: 'clipboard' | 'email' | 'native' | 'whatsapp'; vehicle_slug: string };
  price_alert_opened: { vehicle_slug: string };
  price_alert_created: { vehicle_slug: string };
  price_alert_failed: { vehicle_slug: string };
  valuation_started: Record<string, never>;
  valuation_step_completed: { step: number };
  /** Make and model are empty when typed by hand rather than picked from the catalog: free text stays out. */
  valuation_sent_to_whatsapp: { has_photos: boolean; make: string; model: string; total_steps: number; year: number };
};

/** An event as plain data, so a server component can hand it to a client link. */
export type AnalyticsEvent = {
  [EventName in keyof AnalyticsEventProperties]: { name: EventName; properties: AnalyticsEventProperties[EventName] };
}[keyof AnalyticsEventProperties];

export function captureAnalyticsEvent<EventName extends keyof AnalyticsEventProperties>(
  eventName: EventName,
  properties: AnalyticsEventProperties[EventName],
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  posthog.capture(eventName, properties);
}
