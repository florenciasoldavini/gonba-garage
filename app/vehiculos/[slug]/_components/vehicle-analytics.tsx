'use client';

import { useEffect } from 'react';

import { captureAnalyticsEvent } from '@/lib/analytics/client';

type VehicleAnalyticsProps = {
  bodyType: string;
  currency: string;
  make: string;
  model: string;
  price: number;
  vehicleSlug: string;
  year: number;
};

export function VehicleAnalytics(props: VehicleAnalyticsProps) {
  useEffect(() => {
    captureAnalyticsEvent('vehicle_viewed', {
      body_type: props.bodyType,
      currency: props.currency,
      make: props.make,
      model: props.model,
      price: props.price,
      vehicle_slug: props.vehicleSlug,
      year: props.year,
    });
  }, [props.bodyType, props.currency, props.make, props.model, props.price, props.vehicleSlug, props.year]);

  return null;
}
