import type { VehicleStatus } from '@/features/vehicles/domain/vehicle';

const vehicleStatusPresentation = {
  active: {
    label: 'Disponible',
    schemaAvailability: 'https://schema.org/InStock',
    isAvailable: true,
  },
  paused: {
    label: 'Pausado',
    schemaAvailability: 'https://schema.org/OutOfStock',
    isAvailable: false,
  },
  sold: {
    label: 'Vendido',
    schemaAvailability: 'https://schema.org/SoldOut',
    isAvailable: false,
  },
} as const satisfies Record<VehicleStatus, {
  label: string;
  schemaAvailability: string;
  isAvailable: boolean;
}>;

export function getVehicleStatusPresentation(status: VehicleStatus) {
  return vehicleStatusPresentation[status];
}
