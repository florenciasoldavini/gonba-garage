'use client';

import { useMemo, useState } from 'react';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { CatalogEmptyState } from './catalog-empty-state';
import { CatalogVehicleCard } from './catalog-vehicle-card';
import { InventoryFilters } from './inventory-filters';
import { InventoryToolbar, type InventorySort } from './inventory-toolbar';
import { VehicleCompareDialog } from './vehicle-compare-dialog';
import { VehicleCompareDock } from './vehicle-compare-dock';

type InventoryCatalogProps = {
  vehicles: Vehicle[];
  initialCompareSlug?: string;
};

const MAX_COMPARE_VEHICLES = 3;
const MIN_PRICE = 0;
const PRICE_STEP = 5000;
const MIN_MILEAGE = 0;
const MILEAGE_STEP = 5000;

export function InventoryCatalog({ vehicles, initialCompareSlug }: InventoryCatalogProps) {
  const priceCeiling = useMemo(
    () => Math.ceil(Math.max(...vehicles.map(({ price }) => price), PRICE_STEP) / PRICE_STEP) * PRICE_STEP,
    [vehicles],
  );
  const mileageCeiling = useMemo(
    () => Math.ceil(Math.max(...vehicles.map(({ mileageKm }) => mileageKm), MILEAGE_STEP) / MILEAGE_STEP) * MILEAGE_STEP,
    [vehicles],
  );
  const [query, setQuery] = useState('');
  const [make, setMake] = useState('all');
  const [transmission, setTransmission] = useState('all');
  const [bodyType, setBodyType] = useState('all');
  const [fuel, setFuel] = useState('all');
  const [minPrice, setMinPrice] = useState(MIN_PRICE);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);
  const [minMileage, setMinMileage] = useState(MIN_MILEAGE);
  const [maxMileage, setMaxMileage] = useState(mileageCeiling);
  const [sort, setSort] = useState<InventorySort>('featured');
  const [selectedVehicles, setSelectedVehicles] = useState<Vehicle[]>(() => {
    const initialVehicle = vehicles.find(({ slug }) => slug === initialCompareSlug);
    return initialVehicle ? [initialVehicle] : [];
  });
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const makes = useMemo(() => [...new Set(vehicles.map(({ make: value }) => value))].sort(), [vehicles]);
  const bodyTypes = useMemo(() => [...new Set(vehicles.map(({ body }) => body.split(' · ')[0]))].sort(), [vehicles]);
  const fuelTypes = useMemo(() => [...new Set(vehicles.map(({ fuel: value }) => value))].sort(), [vehicles]);

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const result = vehicles.filter((vehicle) => {
      const searchable = `${vehicle.make} ${vehicle.model} ${vehicle.version} ${vehicle.year}`.toLocaleLowerCase('es');
      const transmissionType = vehicle.transmission.toLocaleLowerCase('es').startsWith('autom') ? 'automatic' : 'manual';

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (make === 'all' || vehicle.make === make) &&
        (transmission === 'all' || transmissionType === transmission) &&
        (bodyType === 'all' || vehicle.body.split(' · ')[0] === bodyType) &&
        (fuel === 'all' || vehicle.fuel === fuel) &&
        vehicle.price >= minPrice && vehicle.price <= maxPrice &&
        vehicle.mileageKm >= minMileage && vehicle.mileageKm <= maxMileage
      );
    });

    return result.toSorted((a, b) => {
      if (sort === 'newest') return b.year - a.year;
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'mileage') return a.mileageKm - b.mileageKm;
      return vehicles.indexOf(a) - vehicles.indexOf(b);
    });
  }, [bodyType, fuel, make, maxMileage, maxPrice, minMileage, minPrice, query, sort, transmission, vehicles]);

  const activeFilterCount = [
    query,
    make !== 'all',
    transmission !== 'all',
    bodyType !== 'all',
    fuel !== 'all',
    minPrice !== MIN_PRICE || maxPrice !== priceCeiling,
    minMileage !== MIN_MILEAGE || maxMileage !== mileageCeiling,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setQuery('');
    setMake('all');
    setTransmission('all');
    setBodyType('all');
    setFuel('all');
    setMinPrice(MIN_PRICE);
    setMaxPrice(priceCeiling);
    setMinMileage(MIN_MILEAGE);
    setMaxMileage(mileageCeiling);
  };

  const selectedVehicleSlugs = useMemo(() => new Set(selectedVehicles.map(({ slug }) => slug)), [selectedVehicles]);

  const toggleVehicleComparison = (vehicle: Vehicle) => {
    if (selectedVehicleSlugs.has(vehicle.slug) && selectedVehicles.length <= 2) setIsCompareOpen(false);
    setSelectedVehicles((current) => {
      if (current.some(({ slug }) => slug === vehicle.slug)) return current.filter(({ slug }) => slug !== vehicle.slug);
      if (current.length >= MAX_COMPARE_VEHICLES) return current;
      return [...current, vehicle];
    });
  };

  const removeVehicleComparison = (slug: string) => {
    if (selectedVehicles.length <= 2) setIsCompareOpen(false);
    setSelectedVehicles((current) => current.filter((vehicle) => vehicle.slug !== slug));
  };

  const clearVehicleComparison = () => {
    setSelectedVehicles([]);
    setIsCompareOpen(false);
  };

  return (
    <section className="section-shell catalog-layout" id="inventario" aria-label="Catálogo de vehículos">
      <InventoryFilters
        activeFilterCount={activeFilterCount}
        bodyType={bodyType}
        bodyTypes={bodyTypes}
        fuel={fuel}
        fuelTypes={fuelTypes}
        make={make}
        makes={makes}
        maxMileage={maxMileage}
        maxPrice={maxPrice}
        mileageCeiling={mileageCeiling}
        mileageStep={MILEAGE_STEP}
        minMileage={minMileage}
        minPrice={minPrice}
        onBodyTypeChange={setBodyType}
        onFuelChange={setFuel}
        onMakeChange={setMake}
        onMaxMileageChange={setMaxMileage}
        onMaxPriceChange={setMaxPrice}
        onMinMileageChange={setMinMileage}
        onMinPriceChange={setMinPrice}
        onQueryChange={setQuery}
        onReset={resetFilters}
        onTransmissionChange={setTransmission}
        priceCeiling={priceCeiling}
        priceStep={PRICE_STEP}
        query={query}
        transmission={transmission}
      />

      <div className="catalog-results">
        <InventoryToolbar count={filteredVehicles.length} onSortChange={setSort} sort={sort} />
        {filteredVehicles.length > 0 ? (
          <div className="catalog-grid">
            {filteredVehicles.map((vehicle, index) => {
              const isSelected = selectedVehicleSlugs.has(vehicle.slug);
              return (
                <CatalogVehicleCard
                  compareDisabled={selectedVehicles.length >= MAX_COMPARE_VEHICLES && !isSelected}
                  index={index}
                  isSelected={isSelected}
                  key={vehicle.slug}
                  onToggleComparison={toggleVehicleComparison}
                  vehicle={vehicle}
                />
              );
            })}
          </div>
        ) : <CatalogEmptyState onReset={resetFilters} />}
      </div>

      <VehicleCompareDock
        maximum={MAX_COMPARE_VEHICLES}
        onClear={clearVehicleComparison}
        onCompare={() => setIsCompareOpen(true)}
        onRemove={removeVehicleComparison}
        vehicles={selectedVehicles}
      />
      <VehicleCompareDialog
        vehicles={selectedVehicles}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        onRemove={removeVehicleComparison}
        onClear={clearVehicleComparison}
      />
    </section>
  );
}
