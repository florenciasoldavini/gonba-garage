'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { CatalogEmptyState } from './catalog-empty-state';
import { CatalogVehicleCard } from './catalog-vehicle-card';
import { InventoryFilters, type InventoryFiltersProps } from './inventory-filters';
import { InventoryToolbar, type InventorySort } from './inventory-toolbar';
import { MobileInventoryFilters } from './mobile-inventory-filters';
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
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const lastAnalyticsPayloadRef = useRef('');

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

  useEffect(() => {
    if (activeFilterCount === 0) return;

    const properties = {
      active_filter_count: activeFilterCount,
      body_type: bodyType,
      fuel,
      make,
      max_mileage: maxMileage,
      max_price: maxPrice,
      min_mileage: minMileage,
      min_price: minPrice,
      result_count: filteredVehicles.length,
      search_length: query.trim().length,
      search_used: query.trim().length > 0,
      sort,
      transmission,
    };
    const serializedPayload = JSON.stringify(properties);

    if (serializedPayload === lastAnalyticsPayloadRef.current) return;

    const timeout = window.setTimeout(() => {
      captureAnalyticsEvent('inventory_filtered', properties);
      if (properties.result_count === 0) {
        captureAnalyticsEvent('inventory_zero_results', {
          active_filter_count: activeFilterCount,
          body_type: bodyType,
          fuel,
          make,
          search_used: properties.search_used,
          transmission,
        });
      }
      lastAnalyticsPayloadRef.current = serializedPayload;
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [activeFilterCount, bodyType, filteredVehicles.length, fuel, make, maxMileage, maxPrice, minMileage, minPrice, query, sort, transmission]);

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
    if (selectedVehicleSlugs.has(vehicle.slug)) {
      if (selectedVehicles.length <= 2) setIsCompareOpen(false);
      captureAnalyticsEvent('comparison_vehicle_removed', {
        vehicle_slug: vehicle.slug,
        selection_count: selectedVehicles.length - 1,
      });
      setSelectedVehicles((current) => current.filter(({ slug }) => slug !== vehicle.slug));
      return;
    }

    if (selectedVehicles.length >= MAX_COMPARE_VEHICLES) return;

    captureAnalyticsEvent('comparison_vehicle_added', {
      vehicle_slug: vehicle.slug,
      selection_count: selectedVehicles.length + 1,
    });
    setSelectedVehicles((current) => [...current, vehicle]);
  };

  const removeVehicleComparison = (slug: string) => {
    if (selectedVehicles.length <= 2) setIsCompareOpen(false);
    captureAnalyticsEvent('comparison_vehicle_removed', {
      vehicle_slug: slug,
      selection_count: Math.max(0, selectedVehicles.length - 1),
    });
    setSelectedVehicles((current) => current.filter((vehicle) => vehicle.slug !== slug));
  };

  const openVehicleComparison = () => {
    captureAnalyticsEvent('comparison_opened', {
      vehicle_count: selectedVehicles.length,
      vehicle_slugs: selectedVehicles.map(({ slug }) => slug),
    });
    setIsCompareOpen(true);
  };

  const clearVehicleComparison = () => {
    setSelectedVehicles([]);
    setIsCompareOpen(false);
  };

  const filterProps: InventoryFiltersProps = {
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
    mileageStep: MILEAGE_STEP,
    minMileage,
    minPrice,
    onBodyTypeChange: setBodyType,
    onFuelChange: setFuel,
    onMakeChange: setMake,
    onMaxMileageChange: setMaxMileage,
    onMaxPriceChange: setMaxPrice,
    onMinMileageChange: setMinMileage,
    onMinPriceChange: setMinPrice,
    onReset: resetFilters,
    onTransmissionChange: setTransmission,
    priceCeiling,
    priceStep: PRICE_STEP,
    transmission,
  };

  return (
    <section className="section-shell catalog-layout" id="inventario" aria-label="Catálogo de vehículos">
      <InventoryFilters {...filterProps} className="catalog-filters-desktop" />

      <div className="catalog-results">
        <InventoryToolbar
          activeFilterCount={activeFilterCount}
          count={filteredVehicles.length}
          onOpenFilters={() => setIsMobileFiltersOpen(true)}
          onQueryChange={setQuery}
          onSortChange={setSort}
          query={query}
          sort={sort}
        />
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

      <MobileInventoryFilters
        filters={filterProps}
        isOpen={isMobileFiltersOpen}
        onClose={() => setIsMobileFiltersOpen(false)}
        resultCount={filteredVehicles.length}
      />

      <VehicleCompareDock
        maximum={MAX_COMPARE_VEHICLES}
        onClear={clearVehicleComparison}
        onCompare={openVehicleComparison}
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
