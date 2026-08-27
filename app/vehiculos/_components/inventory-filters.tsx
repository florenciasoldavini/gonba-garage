'use client';

import { SlidersHorizontal } from 'lucide-react';

import { CustomSelect } from '@/components/ui/custom-select';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { DualRangeFilter } from './dual-range-filter';

export type InventoryFiltersProps = {
  activeFilterCount: number;
  bodyType: string;
  bodyTypes: string[];
  fuel: string;
  fuelTypes: string[];
  make: string;
  makes: string[];
  maxMileage: number;
  maxPrice: number;
  mileageCeiling: number;
  mileageStep: number;
  minMileage: number;
  minPrice: number;
  onBodyTypeChange: (value: string) => void;
  onFuelChange: (value: string) => void;
  onMakeChange: (value: string) => void;
  onMaxMileageChange: (value: number) => void;
  onMaxPriceChange: (value: number) => void;
  onMinMileageChange: (value: number) => void;
  onMinPriceChange: (value: number) => void;
  onReset: () => void;
  onTransmissionChange: (value: string) => void;
  priceCeiling: number;
  priceStep: number;
  transmission: string;
  className?: string;
};

export function InventoryFilters({
  activeFilterCount,
  bodyType,
  bodyTypes,
  fuel,
  fuelTypes,
  make,
  makes,
  maxMileage,
  maxPrice,
  mileageCeiling,
  mileageStep,
  minMileage,
  minPrice,
  onBodyTypeChange,
  onFuelChange,
  onMakeChange,
  onMaxMileageChange,
  onMaxPriceChange,
  onMinMileageChange,
  onMinPriceChange,
  onReset,
  onTransmissionChange,
  priceCeiling,
  priceStep,
  transmission,
  className = '',
}: InventoryFiltersProps) {
  return (
    <aside className={`catalog-filters glass-panel${className ? ` ${className}` : ''}`} aria-label="Filtros del inventario">
      <div className="catalog-filter-heading">
        <div>
          <span className="catalog-kicker"><SlidersHorizontal aria-hidden="true" size={13} /> Filtrar</span>
          <strong>Encontrá tu auto</strong>
        </div>
        {activeFilterCount > 0 ? (
          <button type="button" onClick={onReset}>Limpiar ({activeFilterCount})</button>
        ) : null}
      </div>

      <div className="catalog-field">
        <span>Marca</span>
        <CustomSelect ariaLabel="Filtrar por marca" value={make} onChange={onMakeChange} options={[{ value: 'all', label: 'Todas las marcas' }, ...makes.map((value) => ({ value, label: value }))]} />
      </div>
      <div className="catalog-field">
        <span>Transmisión</span>
        <CustomSelect ariaLabel="Filtrar por transmisión" value={transmission} onChange={onTransmissionChange} options={[{ value: 'all', label: 'Todas' }, { value: 'automatic', label: 'Automática' }, { value: 'manual', label: 'Manual' }]} />
      </div>
      <div className="catalog-field">
        <span>Tipo</span>
        <CustomSelect ariaLabel="Filtrar por tipo de carrocería" value={bodyType} onChange={onBodyTypeChange} options={[{ value: 'all', label: 'Todas las carrocerías' }, ...bodyTypes.map((value) => ({ value, label: value }))]} />
      </div>
      <div className="catalog-field">
        <span>Combustible</span>
        <CustomSelect ariaLabel="Filtrar por combustible" value={fuel} onChange={onFuelChange} options={[{ value: 'all', label: 'Todos los combustibles' }, ...fuelTypes.map((value) => ({ value, label: value }))]} />
      </div>

      <DualRangeFilter
        formatValue={formatVehiclePrice}
        label="Rango de precio"
        maximum={priceCeiling}
        maximumAriaLabel="Precio máximo"
        maximumValue={maxPrice}
        minimum={0}
        minimumAriaLabel="Precio mínimo"
        minimumValue={minPrice}
        onMaximumChange={onMaxPriceChange}
        onMinimumChange={onMinPriceChange}
        step={priceStep}
      />
      <DualRangeFilter
        formatValue={formatVehicleMileage}
        label="Rango de kilometraje"
        maximum={mileageCeiling}
        maximumAriaLabel="Kilometraje máximo"
        maximumValue={maxMileage}
        minimum={0}
        minimumAriaLabel="Kilometraje mínimo"
        minimumValue={minMileage}
        onMaximumChange={onMaxMileageChange}
        onMinimumChange={onMinMileageChange}
        step={mileageStep}
      />

      <p className="catalog-filter-note">Precios y disponibilidad sujetos a confirmación.</p>
    </aside>
  );
}
