import type { Vehicle, VehicleStatus } from '@/features/vehicles/domain/vehicle';

/**
 * Mercado Libre has no reserved or sold status. The seller pauses a publication when a buyer
 * reserves the car in person, and after the sale usually leaves it paused until it expires and
 * closes. So a paused car reads as reserved for this many days after the pause, then as sold, and
 * a closed one always reads as sold.
 */
export const RESERVATION_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a visitor is told. Closed publications never reach the page as their own status. */
export type VehicleDisplayStatus = Exclude<VehicleStatus, 'closed'>;

const vehicleStatusPresentation = {
  active: {
    label: 'Disponible',
    schemaAvailability: 'https://schema.org/InStock',
    isAvailable: true,
  },
  paused: {
    label: 'Reservado',
    schemaAvailability: 'https://schema.org/Reserved',
    isAvailable: false,
  },
  sold: {
    label: 'Vendido',
    schemaAvailability: 'https://schema.org/SoldOut',
    isAvailable: false,
  },
} as const satisfies Record<VehicleDisplayStatus, {
  label: string;
  schemaAvailability: string;
  isAvailable: boolean;
}>;

/**
 * `updatedAt` is the last real content or availability change, so for a paused car it is when the
 * pause was recorded (or a later edit of the listing, which restarts the window).
 */
export function getVehicleDisplayStatus(
  { status, updatedAt }: Pick<Vehicle, 'status' | 'updatedAt'>,
  now = Date.now(),
): VehicleDisplayStatus {
  if (status === 'closed') return 'sold';
  if (status === 'paused' && now - Date.parse(updatedAt) > RESERVATION_WINDOW_DAYS * DAY_MS) return 'sold';
  return status;
}

export function getVehicleStatusPresentation(vehicle: Pick<Vehicle, 'status' | 'updatedAt'>, now?: number) {
  const status = getVehicleDisplayStatus(vehicle, now);
  return { status, ...vehicleStatusPresentation[status] };
}
