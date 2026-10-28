import type { Vehicle, VehicleStatus } from '@/features/vehicles/domain/vehicle';
import type {
  MercadoLibreAttribute,
  MercadoLibreDescription,
  MercadoLibreItem,
  MercadoLibrePublication,
} from '@/lib/integrations/mercado-libre/types';

const HIGHLIGHT_ATTRIBUTE_IDS = [
  'HAS_ABS_BRAKES',
  'HAS_AIR_CONDITIONING',
  'HAS_ALLOY_WHEELS',
  'HAS_ANDROID_AUTO',
  'HAS_APPLE_CARPLAY',
  'HAS_AUTOPILOT',
  'HAS_BLUETOOTH',
  'HAS_GPS',
  'HAS_LEATHER_UPHOLSTERY',
  'HAS_PARKING_SENSOR',
  'HAS_REAR_PARKING_SENSOR',
  'HAS_SLIDING_ROOF',
] as const;

function attribute(item: MercadoLibreItem, id: string) {
  return item.attributes?.find((candidate) => candidate.id === id);
}

function attributeText(item: MercadoLibreItem, id: string) {
  const candidate = attribute(item, id);

  if (!candidate) return null;
  if (candidate.value_name?.trim()) return candidate.value_name.trim();
  if (candidate.value_struct?.number == null) return null;

  return `${candidate.value_struct.number}${candidate.value_struct.unit ? ` ${candidate.value_struct.unit}` : ''}`;
}

function attributeNumber(item: MercadoLibreItem, id: string) {
  const candidate = attribute(item, id);
  const structuredNumber = candidate?.value_struct?.number;

  if (typeof structuredNumber === 'number') return structuredNumber;

  const value = structuredNumber ?? candidate?.value_name;
  const normalized = String(value ?? '').replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function secureImageUrl(value?: string) {
  return value?.replace(/^http:\/\//, 'https://') ?? null;
}

function mapStatus(status?: string): VehicleStatus {
  if (status === 'active') return 'active';
  if (status === 'paused') return 'paused';
  if (status === 'closed') return 'closed';
  return 'paused';
}

function mapCurrency(currency?: string): Vehicle['currency'] {
  return currency === 'ARS' ? 'ARS' : 'USD';
}

function formatLocation(item: MercadoLibreItem) {
  const city = item.seller_address?.city?.name ?? item.seller_address?.search_location?.city?.name;
  const state = item.seller_address?.state?.name ?? item.seller_address?.search_location?.state?.name;
  const country = item.seller_address?.country?.name;

  return [city, state, country].filter(Boolean).join(', ') || 'Argentina';
}

function formatTransmission(item: MercadoLibreItem) {
  const transmission = attributeText(item, 'TRANSMISSION') ?? 'Sin especificar';
  const gears = attributeNumber(item, 'GEAR_NUMBER');

  return gears > 0 ? `${transmission}, ${gears} marchas` : transmission;
}

function formatEngine(item: MercadoLibreItem) {
  return [
    attributeText(item, 'ENGINE'),
    attributeText(item, 'ENGINE_DISPLACEMENT'),
    attributeText(item, 'POWER'),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index).join(' · ') || 'Sin especificar';
}

function formatBody(item: MercadoLibreItem) {
  const body = attributeText(item, 'VEHICLE_BODY_TYPE') ?? 'Sin especificar';
  const doors = attributeNumber(item, 'DOORS');

  return doors > 0 ? `${body} · ${doors} puertas` : body;
}

function highlights(attributes: MercadoLibreAttribute[] = []) {
  const priority = new Map<string, number>(
    HIGHLIGHT_ATTRIBUTE_IDS.map((id, index) => [id, index]),
  );

  return attributes
    .filter(({ id, value_name }) => priority.has(id) && value_name?.toLocaleLowerCase('es') === 'sí')
    .toSorted((left, right) => (priority.get(left.id) ?? 99) - (priority.get(right.id) ?? 99))
    .map(({ name }) => name)
    .slice(0, 6);
}

export function mapMercadoLibreItemToVehicle(
  item: MercadoLibreItem,
  description: MercadoLibreDescription | null = null,
): MercadoLibrePublication {
  const make = attributeText(item, 'BRAND') ?? 'Sin marca';
  const model = attributeText(item, 'MODEL') ?? item.title;
  const version = attributeText(item, 'TRIM') ?? attributeText(item, 'SHORT_VERSION') ?? '';
  const primaryImage = secureImageUrl(item.pictures?.[0]?.secure_url)
    ?? secureImageUrl(item.pictures?.[0]?.url)
    ?? secureImageUrl(item.secure_thumbnail)
    ?? secureImageUrl(item.thumbnail)
    ?? '/showroom-car.jpg';
  const descriptionText = description?.plain_text?.trim() || description?.text?.trim() || '';

  return {
    source: item,
    description,
    vehicle: {
      slug: `${slugify(`${make}-${model}-${version}`)}-${item.id.toLowerCase()}`,
      make,
      model,
      version,
      year: attributeNumber(item, 'VEHICLE_YEAR'),
      price: item.price ?? 0,
      currency: mapCurrency(item.currency_id),
      mileageKm: attributeNumber(item, 'KILOMETERS'),
      transmission: formatTransmission(item),
      fuel: attributeText(item, 'FUEL_TYPE') ?? 'Sin especificar',
      engine: formatEngine(item),
      color: attributeText(item, 'COLOR') ?? 'Sin especificar',
      body: formatBody(item),
      traction: attributeText(item, 'TRACTION_CONTROL') ?? 'Sin especificar',
      location: formatLocation(item),
      stockCode: item.seller_custom_field?.trim() || item.id,
      image: primaryImage,
      imageAlt: item.title,
      description: descriptionText,
      highlights: highlights(item.attributes),
      status: mapStatus(item.status),
      mercadoLibreId: item.id,
      mercadoLibreUrl: item.permalink,
      updatedAt: item.last_updated ?? item.date_created ?? new Date(0).toISOString(),
    },
  };
}
