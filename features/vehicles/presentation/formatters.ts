import { comparableUsdPrice, type MepQuote } from '@/features/vehicles/domain/catalog-pricing';
import { VEHICLE_PHOTO_PLACEHOLDER, type Vehicle } from '@/features/vehicles/domain/vehicle';

export function formatVehiclePrice(amount: number, currency: Vehicle['currency'] = 'USD') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatVehicleMileage(mileageKm: number) {
  return `${new Intl.NumberFormat('es-AR').format(mileageKm)} km`;
}

/** Alt text for `vehicle.image`, which says so when the publication has no photo. */
export function formatVehicleImageAlt({ image, imageAlt }: Pick<Vehicle, 'image' | 'imageAlt'>) {
  return image === VEHICLE_PHOTO_PLACEHOLDER ? `${imageAlt}: foto no disponible` : imageAlt;
}

/**
 * A rough dollar figure under a peso price, never a replacement for it: the seller's price stays the
 * main one. Rounded to US$ 50 so it does not read as an exact quote. Null for dollar prices and when
 * the MEP quote is unavailable.
 */
export function formatApproximateUsdPrice(vehicle: Pick<Vehicle, 'price' | 'currency'>, quote: MepQuote | null) {
  if (vehicle.currency !== 'ARS' || vehicle.price <= 0) return null;
  const usd = comparableUsdPrice(vehicle, quote);
  return usd === null ? null : formatVehiclePrice(Math.round(usd / 50) * 50, 'USD');
}
