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
