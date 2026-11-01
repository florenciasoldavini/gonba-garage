/**
 * The only Mercado Libre Argentina categories the catalog stores: cars and pickups (used, new,
 * classic and damaged) and motorcycles. Trucks, boats, machinery, savings plans, scale models and
 * accessories are never stored. A listing qualifies when its category is one of these or sits below
 * one, so a future split of a category keeps working. The database enforces the same list through
 * catalog_publications_vehicle_category_check (database/migrations/20261102_catalog_vehicle_category.sql):
 * change both together.
 */
export const VEHICLE_CATEGORIES = {
  MLA1744: 'Autos y Camionetas',
  MLA459682: 'Autos y Camionetas Nuevos',
  MLA1745: 'Autos de Colección',
  MLA93412: 'Autos Chocados y Averiados',
  MLA1763: 'Motos',
} as const;

export type VehicleCategory = keyof typeof VEHICLE_CATEGORIES;

/** The qualifying category in a category's ancestry (root first), or null for anything else. */
export function vehicleCategoryOf(path: string[]): VehicleCategory | null {
  return (path.find(id => Object.hasOwn(VEHICLE_CATEGORIES, id)) as VehicleCategory | undefined) ?? null;
}
