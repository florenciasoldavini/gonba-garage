import type { Vehicle } from '@/features/vehicles/domain/vehicle';

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
