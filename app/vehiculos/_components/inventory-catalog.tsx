'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Scale, Search, SlidersHorizontal, X } from 'lucide-react';

import { CustomSelect } from '@/components/ui/custom-select';
import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import { VehicleCompareDialog } from './vehicle-compare-dialog';

type InventoryCatalogProps = {
  vehicles: Vehicle[];
  initialCompareSlug?: string;
};

type SortOption = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'mileage';
const MAX_COMPARE_VEHICLES = 3;
const MIN_PRICE = 0;
const PRICE_STEP = 5000;
const MIN_MILEAGE = 0;
const MILEAGE_STEP = 5000;
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'featured', label: 'Destacados' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'price-asc', label: 'Menor precio' },
  { value: 'price-desc', label: 'Mayor precio' },
  { value: 'mileage', label: 'Menor kilometraje' },
];

const formatPrice = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);

const formatMileage = (amount: number) =>
  `${new Intl.NumberFormat('es-AR').format(amount)} km`;

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
  const [sort, setSort] = useState<SortOption>('featured');
  const [selectedVehicles, setSelectedVehicles] = useState<Vehicle[]>(() => {
    const initialVehicle = vehicles.find(({ slug }) => slug === initialCompareSlug);
    return initialVehicle ? [initialVehicle] : [];
  });
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const makes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.make))].sort(),
    [vehicles],
  );
  const bodyTypes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.body.split(' · ')[0]))].sort(),
    [vehicles],
  );
  const fuelTypes = useMemo(
    () => [...new Set(vehicles.map((vehicle) => vehicle.fuel))].sort(),
    [vehicles],
  );

  const filteredVehicles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    const result = vehicles.filter((vehicle) => {
      const searchable = `${vehicle.make} ${vehicle.model} ${vehicle.version} ${vehicle.year}`.toLocaleLowerCase('es');
      const transmissionType = vehicle.transmission.toLocaleLowerCase('es').startsWith('autom')
        ? 'automatic'
        : 'manual';

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (make === 'all' || vehicle.make === make) &&
        (transmission === 'all' || transmissionType === transmission) &&
        (bodyType === 'all' || vehicle.body.split(' · ')[0] === bodyType) &&
        (fuel === 'all' || vehicle.fuel === fuel) &&
        vehicle.price >= minPrice &&
        vehicle.price <= maxPrice &&
        vehicle.mileageKm >= minMileage &&
        vehicle.mileageKm <= maxMileage
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

  const priceFilterIsActive = minPrice !== MIN_PRICE || maxPrice !== priceCeiling;
  const mileageFilterIsActive = minMileage !== MIN_MILEAGE || maxMileage !== mileageCeiling;
  const activeFilterCount = [query, make !== 'all', transmission !== 'all', bodyType !== 'all', fuel !== 'all', priceFilterIsActive, mileageFilterIsActive]
    .filter(Boolean).length;

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

  const selectedVehicleSlugs = useMemo(
    () => new Set(selectedVehicles.map(({ slug }) => slug)),
    [selectedVehicles],
  );

  const toggleVehicleComparison = (vehicle: Vehicle) => {
    if (selectedVehicleSlugs.has(vehicle.slug) && selectedVehicles.length <= 2) {
      setIsCompareOpen(false);
    }
    setSelectedVehicles((current) => {
      if (current.some(({ slug }) => slug === vehicle.slug)) {
        return current.filter(({ slug }) => slug !== vehicle.slug);
      }
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
      <aside className="catalog-filters glass-panel" aria-label="Filtros del inventario">
        <div className="catalog-filter-heading">
          <div>
            <span className="catalog-kicker"><SlidersHorizontal aria-hidden="true" size={13} /> Filtrar</span>
            <strong>Encontrá tu auto</strong>
          </div>
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters}>Limpiar ({activeFilterCount})</button>
          )}
        </div>

        <label className="catalog-field catalog-search">
          <span>Buscar</span>
          <span className="catalog-search-control">
            <Search aria-hidden="true" size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Marca, modelo o año"
            />
          </span>
        </label>

        <div className="catalog-field">
          <span>Marca</span>
          <CustomSelect ariaLabel="Filtrar por marca" value={make} onChange={setMake} options={[{ value: 'all', label: 'Todas las marcas' }, ...makes.map((vehicleMake) => ({ value: vehicleMake, label: vehicleMake }))]} />
        </div>

        <div className="catalog-field">
          <span>Transmisión</span>
          <CustomSelect ariaLabel="Filtrar por transmisión" value={transmission} onChange={setTransmission} options={[{ value: 'all', label: 'Todas' }, { value: 'automatic', label: 'Automática' }, { value: 'manual', label: 'Manual' }]} />
        </div>

        <div className="catalog-field">
          <span>Tipo</span>
          <CustomSelect ariaLabel="Filtrar por tipo de carrocería" value={bodyType} onChange={setBodyType} options={[{ value: 'all', label: 'Todas las carrocerías' }, ...bodyTypes.map((type) => ({ value: type, label: type }))]} />
        </div>

        <div className="catalog-field">
          <span>Combustible</span>
          <CustomSelect ariaLabel="Filtrar por combustible" value={fuel} onChange={setFuel} options={[{ value: 'all', label: 'Todos los combustibles' }, ...fuelTypes.map((type) => ({ value: type, label: type }))]} />
        </div>

        <div className="catalog-field catalog-range-filter">
          <div className="catalog-range-heading">
            <span>Rango de precio</span>
            <output>{formatPrice(minPrice)} — {formatPrice(maxPrice)}</output>
          </div>
          <div className="catalog-range-control">
            <div className="catalog-range-track" aria-hidden="true">
              <span style={{ left: `${(minPrice / priceCeiling) * 100}%`, right: `${100 - (maxPrice / priceCeiling) * 100}%` }} />
            </div>
            <input
              aria-label="Precio mínimo"
              type="range"
              min={MIN_PRICE}
              max={priceCeiling}
              step={PRICE_STEP}
              value={minPrice}
              onChange={(event) => setMinPrice(Math.min(Number(event.target.value), maxPrice - PRICE_STEP))}
            />
            <input
              aria-label="Precio máximo"
              type="range"
              min={MIN_PRICE}
              max={priceCeiling}
              step={PRICE_STEP}
              value={maxPrice}
              onChange={(event) => setMaxPrice(Math.max(Number(event.target.value), minPrice + PRICE_STEP))}
            />
          </div>
          <div className="catalog-range-limits" aria-hidden="true"><span>{formatPrice(MIN_PRICE)}</span><span>{formatPrice(priceCeiling)}</span></div>
        </div>

        <div className="catalog-field catalog-range-filter">
          <div className="catalog-range-heading">
            <span>Rango de kilometraje</span>
            <output>{formatMileage(minMileage)} — {formatMileage(maxMileage)}</output>
          </div>
          <div className="catalog-range-control">
            <div className="catalog-range-track" aria-hidden="true">
              <span style={{ left: `${(minMileage / mileageCeiling) * 100}%`, right: `${100 - (maxMileage / mileageCeiling) * 100}%` }} />
            </div>
            <input
              aria-label="Kilometraje mínimo"
              type="range"
              min={MIN_MILEAGE}
              max={mileageCeiling}
              step={MILEAGE_STEP}
              value={minMileage}
              onChange={(event) => setMinMileage(Math.min(Number(event.target.value), maxMileage - MILEAGE_STEP))}
            />
            <input
              aria-label="Kilometraje máximo"
              type="range"
              min={MIN_MILEAGE}
              max={mileageCeiling}
              step={MILEAGE_STEP}
              value={maxMileage}
              onChange={(event) => setMaxMileage(Math.max(Number(event.target.value), minMileage + MILEAGE_STEP))}
            />
          </div>
          <div className="catalog-range-limits" aria-hidden="true"><span>{formatMileage(MIN_MILEAGE)}</span><span>{formatMileage(mileageCeiling)}</span></div>
        </div>

        <p className="catalog-filter-note">Precios y disponibilidad sujetos a confirmación.</p>
      </aside>

      <div className="catalog-results">
        <div className="catalog-toolbar">
          <p aria-live="polite"><strong>{filteredVehicles.length}</strong> {filteredVehicles.length === 1 ? 'vehículo' : 'vehículos'}</p>
          <div className="catalog-sort">
            <span className="catalog-sort-label">Ordenar por</span>
            <CustomSelect ariaLabel="Ordenar vehículos" value={sort} onChange={(value) => setSort(value as SortOption)} options={SORT_OPTIONS} />
          </div>
        </div>

        {filteredVehicles.length > 0 ? (
          <div className="catalog-grid">
            {filteredVehicles.map((vehicle, index) => (
              <article className={`catalog-card glass-panel${selectedVehicleSlugs.has(vehicle.slug) ? ' catalog-card-selected' : ''}`} key={vehicle.slug}>
                  <div className="catalog-card-image">
                    <Link className="catalog-card-image-link" href={`/vehiculos/${vehicle.slug}`} aria-label={`Ver ${vehicle.make} ${vehicle.model}`}>
                      <Image
                        src={vehicle.image}
                        alt={vehicle.imageAlt}
                        fill
                        sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 38vw"
                        className="cover-image"
                      />
                    </Link>
                    <span className="catalog-card-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="catalog-card-status">Disponible</span>
                    <button
                      className="catalog-card-compare"
                      type="button"
                      aria-pressed={selectedVehicleSlugs.has(vehicle.slug)}
                      disabled={selectedVehicles.length >= MAX_COMPARE_VEHICLES && !selectedVehicleSlugs.has(vehicle.slug)}
                      onClick={() => toggleVehicleComparison(vehicle)}
                    >
                      {selectedVehicleSlugs.has(vehicle.slug) ? <Check aria-hidden="true" size={14} /> : <Scale aria-hidden="true" size={14} />}
                      {selectedVehicleSlugs.has(vehicle.slug) ? 'Seleccionado' : 'Comparar'}
                    </button>
                  </div>
                  <div className="catalog-card-copy">
                    <div className="catalog-card-title">
                      <p>{vehicle.year} · {vehicle.body.split(' · ')[0]}</p>
                      <h2><Link href={`/vehiculos/${vehicle.slug}`}>{vehicle.make} {vehicle.model}</Link></h2>
                      <span>{vehicle.version}</span>
                    </div>
                    <Link className="catalog-card-arrow" href={`/vehiculos/${vehicle.slug}`} aria-label={`Ver detalle de ${vehicle.make} ${vehicle.model}`}><ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} /></Link>
                  </div>
                  <div className="catalog-card-facts">
                    <span>{formatMileage(vehicle.mileageKm)}</span>
                    <span>{vehicle.transmission.split(',')[0]}</span>
                    <strong>{formatPrice(vehicle.price)}</strong>
                  </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="catalog-empty glass-panel">
            <span>0 resultados</span>
            <h2>No encontramos una unidad con esos criterios.</h2>
            <p>Probá ampliando el precio o quitando alguno de los filtros.</p>
            <button className="button button-accent" type="button" onClick={resetFilters}>Ver todo el inventario <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} /></button>
          </div>
        )}
      </div>

      {selectedVehicles.length > 0 && (
        <div className="compare-dock-shell" aria-live="polite">
          <div className="compare-dock glass-panel">
            <div className="compare-dock-heading">
              <span><Scale aria-hidden="true" size={17} strokeWidth={1.8} /></span>
              <div><strong>Comparar vehículos</strong><small>{selectedVehicles.length} de {MAX_COMPARE_VEHICLES} seleccionados</small></div>
            </div>
            <div className="compare-dock-slots">
              {selectedVehicles.map((vehicle) => (
                <div className="compare-dock-thumb" key={vehicle.slug}>
                  <Image src={vehicle.image} alt="" fill sizes="76px" className="cover-image" />
                  <button type="button" aria-label={`Quitar ${vehicle.make} ${vehicle.model}`} onClick={() => removeVehicleComparison(vehicle.slug)}><X aria-hidden="true" size={11} /></button>
                </div>
              ))}
              {Array.from({ length: MAX_COMPARE_VEHICLES - selectedVehicles.length }, (_, index) => (
                <div className="compare-dock-empty" aria-hidden="true" key={index}>+</div>
              ))}
            </div>
            <div className="compare-dock-actions">
              <button className="compare-dock-clear" type="button" onClick={clearVehicleComparison}>Limpiar</button>
              <button className="button button-accent" type="button" disabled={selectedVehicles.length < 2} onClick={() => setIsCompareOpen(true)}>
                Comparar {selectedVehicles.length > 1 ? selectedVehicles.length : ''} <Scale aria-hidden="true" size={15} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      )}

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
