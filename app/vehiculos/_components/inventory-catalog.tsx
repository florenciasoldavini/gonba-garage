'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowUpRight } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { CatalogEmptyState } from './catalog-empty-state';
import { CatalogVehicleCard } from './catalog-vehicle-card';
import { InventoryAlert, type InventoryAlertCriteria } from './inventory-alert';
import { InventoryFilters, type InventoryFiltersProps } from './inventory-filters';
import { InventoryToolbar, type InventorySort } from './inventory-toolbar';
import { MobileInventoryFilters } from './mobile-inventory-filters';
import { VehicleCompareDialog } from './vehicle-compare-dialog';
import { VehicleCompareDock } from './vehicle-compare-dock';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

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
  const resultsRef = useRef<HTMLDivElement>(null);
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
  const filteredVehicleKey = filteredVehicles.map(({ slug }) => slug).join('|');

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const cards = gsap.utils.toArray<HTMLElement>('.catalog-card');

      cards.forEach((card, index) => {
        const image = card.querySelector('.catalog-card-image');
        const copy = card.querySelector('.catalog-card-copy');
        const facts = card.querySelector('.catalog-card-facts');

        if (image) {
          gsap.fromTo(
            image,
            { clipPath: 'inset(0 100% 0 0)', autoAlpha: 0.55 },
            {
              clipPath: 'inset(0 0% 0 0)',
              autoAlpha: 1,
              delay: index * 0.07,
              duration: 0.72,
              ease: 'power3.inOut',
            },
          );
        }

        const content = [copy, facts].filter((element): element is Element => element !== null);
        if (content.length > 0) {
          gsap.fromTo(
            content,
            { x: 24, autoAlpha: 0 },
            { x: 0, autoAlpha: 1, delay: 0.18 + index * 0.07, stagger: 0.07, duration: 0.48, ease: 'power3.out' },
          );
        }
      });

      const emptyState = resultsRef.current?.querySelector('.catalog-empty');
      if (emptyState) {
        gsap.fromTo(
          emptyState,
          { y: 24, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out' },
        );
      }
    },
    { scope: resultsRef, dependencies: [filteredVehicleKey], revertOnUpdate: true },
  );

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

  const alertCriteria: InventoryAlertCriteria = {
    query: query.trim(),
    make: make === 'all' ? '' : make,
    transmission: transmission === 'all' ? '' : transmission,
    bodyType: bodyType === 'all' ? '' : bodyType,
    fuel: fuel === 'all' ? '' : fuel,
    minPrice: minPrice === MIN_PRICE ? null : minPrice,
    maxPrice: maxPrice === priceCeiling ? null : maxPrice,
    minMileage: minMileage === MIN_MILEAGE ? null : minMileage,
    maxMileage: maxMileage === mileageCeiling ? null : maxMileage,
  };

  const toolbarAlert = (
    <InventoryAlert
      activeFilterCount={activeFilterCount}
      criteria={alertCriteria}
      placement="toolbar"
      resultCount={filteredVehicles.length}
    />
  );

  return (
    <>
      <section className="section-shell catalog-layout" id="inventario" aria-label="Catálogo de vehículos">
        <InventoryFilters {...filterProps} className="catalog-filters-desktop" />

        <div className="catalog-results" ref={resultsRef}>
          <InventoryToolbar
            activeFilterCount={activeFilterCount}
            alertAction={toolbarAlert}
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
          ) : (
            <CatalogEmptyState
              alertAction={(
                <InventoryAlert
                  activeFilterCount={activeFilterCount}
                  criteria={alertCriteria}
                  placement="empty"
                  resultCount={0}
                />
              )}
              onReset={resetFilters}
            />
          )}
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

      <section className="section-shell catalog-contact glass-panel" aria-labelledby="catalog-contact-title">
        <div>
          <Eyebrow>¿No encontraste lo que buscabas?</Eyebrow>
          <h2 id="catalog-contact-title">Contanos qué auto tenés en mente.</h2>
        </div>
        <ButtonLink href="/#contacto" variant="accent">
          Hablar con Gonba&apos;s Garage <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
        </ButtonLink>
      </section>
    </>
  );
}
