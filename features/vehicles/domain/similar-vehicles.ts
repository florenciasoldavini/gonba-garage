import type { Vehicle } from '@/features/vehicles/domain/vehicle';

const bodyType = (vehicle: Vehicle) => vehicle.body.split(' · ')[0];

/**
 * Available alternatives to a car that is no longer for sale, most similar first: same model (often
 * the same car relisted under a new publication), then body type, make and age. Ties go to the
 * closest price in the same currency, then to the catalog order.
 */
export function pickSimilarVehicles(vehicle: Vehicle, candidates: Vehicle[], limit = 3) {
  const score = (candidate: Vehicle) =>
    (candidate.make === vehicle.make && candidate.model === vehicle.model ? 8 : 0) +
    (bodyType(candidate) === bodyType(vehicle) ? 4 : 0) +
    (candidate.make === vehicle.make ? 2 : 0) +
    (Math.abs(candidate.year - vehicle.year) <= 3 ? 1 : 0);
  const priceGap = (candidate: Vehicle) => candidate.currency === vehicle.currency && vehicle.price > 0
    ? Math.abs(candidate.price - vehicle.price) / vehicle.price
    : Infinity;

  return candidates
    .filter((candidate) => candidate.status === 'active' && candidate.slug !== vehicle.slug)
    .map((candidate, order) => ({ candidate, order, score: score(candidate), gap: priceGap(candidate) }))
    .sort((a, b) => b.score - a.score || a.gap - b.gap || a.order - b.order)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
