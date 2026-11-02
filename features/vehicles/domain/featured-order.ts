import { VEHICLE_PHOTO_PLACEHOLDER, type Vehicle } from './vehicle';

/** Older or more driven cars still list, after the rest of the stock. */
const SHOWCASE_MAX_AGE_YEARS = 15;
const SHOWCASE_MAX_MILEAGE_KM = 150_000;
/** The home page shows the first ones, so the catalog opens with the same cars. */
const SHOWCASE_PICKS = 3;

type FeaturedFields = Pick<Vehicle, 'make' | 'year' | 'mileageKm' | 'image'>;

/**
 * A missing year or kilometers attribute maps to 0, so a car only qualifies with real values: a
 * listing at 0 km must be of this or last year. A car without photos never qualifies.
 */
function isShowcaseGrade(vehicle: FeaturedFields, currentYear: number) {
  const knownMileage = vehicle.mileageKm > 0 || vehicle.year >= currentYear - 1;
  return vehicle.image !== VEHICLE_PHOTO_PLACEHOLDER
    && vehicle.year >= currentYear - SHOWCASE_MAX_AGE_YEARS && vehicle.year <= currentYear + 1
    && knownMileage && vehicle.mileageKm <= SHOWCASE_MAX_MILEAGE_KM;
}

/**
 * The default ("Destacados") order, automatic from the Mercado Libre data. `vehicles` comes newest
 * listing first. First the newest, least driven showcase-grade cars, one per make while possible;
 * then the other showcase-grade cars and last the rest, both still newest listing first.
 */
export function orderFeaturedVehicles<T extends FeaturedFields>(vehicles: T[], currentYear = new Date().getFullYear()) {
  const showcase = new Set(vehicles.filter((vehicle) => isShowcaseGrade(vehicle, currentYear)));
  const ranked = [...showcase].toSorted((a, b) => b.year - a.year || a.mileageKm - b.mileageKm);
  const picks: T[] = [];
  for (const vehicle of ranked) {
    if (picks.length < SHOWCASE_PICKS && !picks.some(({ make }) => make === vehicle.make)) picks.push(vehicle);
  }
  for (const vehicle of ranked) {
    if (picks.length < SHOWCASE_PICKS && !picks.includes(vehicle)) picks.push(vehicle);
  }
  const rest = vehicles.filter((vehicle) => !picks.includes(vehicle));
  return [...picks, ...rest.filter((vehicle) => showcase.has(vehicle)), ...rest.filter((vehicle) => !showcase.has(vehicle))];
}
