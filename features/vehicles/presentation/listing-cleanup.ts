import type { Vehicle } from '@/features/vehicles/domain/vehicle';
import type { MercadoLibreAttribute } from '@/lib/integrations/mercado-libre/types';

/**
 * Automatic cleanup of what the seller types into Mercado Libre. Nobody edits listings by hand on
 * this site, so every fix here is a rule over the publication data, applied when it is read. The
 * mapper's stored output is left as it is: rewriting it would mark every publication as changed on
 * the next sync and restart the reserved window of paused cars.
 */

// Trim and engine names Mercado Libre returns in title case ("Tdi", "Gr-s"), keyed in lowercase.
const VERSION_WORDS: Record<string, string> = {
  amg: 'AMG',
  awd: 'AWD',
  'b.eff': 'BlueEFFICIENCY',
  bt: 'BT',
  cd: 'CD',
  cvt: 'CVT',
  ecoboost: 'EcoBoost',
  ecvt: 'e-CVT',
  ex: 'EX',
  'ex-l': 'EX-L',
  gl: 'GL',
  'gr-s': 'GR-S',
  'gt-line': 'GT-Line',
  gti: 'GTI',
  hev: 'HEV',
  hv: 'HV',
  jcw: 'JCW',
  ls: 'LS',
  ltz: 'LTZ',
  lx: 'LX',
  mt: 'MT',
  at: 'AT',
  sce: 'SCe',
  se: 'SE',
  seg: 'SEG',
  srx: 'SRX',
  stronic: 'S tronic',
  tdi: 'TDI',
  tfsi: 'TFSI',
  thp: 'THP',
  tsi: 'TSI',
  vti: 'VTi',
  vx: 'VX',
  xli: 'XLi',
  '(mexico)': '(México)',
};

/** A seat or door count becomes its own segment: "7as" → "· 7 asientos ·". */
const SEGMENT = '·';

function versionToken(token: string): string[] {
  const lower = token.toLocaleLowerCase('es');
  if (VERSION_WORDS[lower]) return [VERSION_WORDS[lower]];
  // Drive layouts read in lowercase, as on the rest of the site: 4X4 → 4x4.
  if (/^\dx\d$/.test(lower)) return [lower];
  if (/^[24]wd$/.test(lower)) return [lower.toUpperCase()];
  // Power: 105cv, 204Cv, 286hp → 105 CV, 204 CV, 286 HP. A bare "Cv" after a number too.
  const power = lower.match(/^(\d+)(cv|hp)$/);
  if (power) return [power[1], power[2].toUpperCase()];
  if (lower === 'cv' || lower === 'hp') return [lower.toUpperCase()];
  // Automatic gearboxes with their gear count: 6at, At8 → 6AT, 8AT.
  const gearsFirst = lower.match(/^(\d)(at|mt)$/);
  if (gearsFirst) return [`${gearsFirst[1]}${gearsFirst[2].toUpperCase()}`];
  const gearsLast = lower.match(/^(at|mt)(\d)$/);
  if (gearsLast) return [`${gearsLast[2]}${gearsLast[1].toUpperCase()}`];
  const seats = lower.match(/^(\d)as$/);
  if (seats) return [SEGMENT, `${seats[1]} asientos`, SEGMENT];
  const doors = lower.match(/^(\d)p$/);
  if (doors) return [SEGMENT, `${doors[1]} puertas`, SEGMENT];
  // Engine code glued to a displacement or trim: 35tfsi, 2.3bt → 35 TFSI, 2.3 BT.
  const glued = lower.match(/^(\d+(?:\.\d)?)([a-z]{2,})$/);
  if (glued && VERSION_WORDS[glued[2]]) return [glued[1], VERSION_WORDS[glued[2]]];
  // Model and chassis codes: a200, c250, w176, f56, l22, v6 → A200, C250, W176, F56, L22, V6.
  if (/^[a-z]\d+$/.test(lower)) return [lower.toUpperCase()];
  return [token];
}

/** "1.4 Lounge 105cv At" → "1.4 Lounge 105 CV AT"; "2.8 Tdi Gr-s 4x4 7as 6at" → "2.8 TDI GR-S 4x4 · 7 asientos · 6AT". */
export function formatVehicleVersion(version: string) {
  const parts = version.trim().split(/\s+/).filter(Boolean).flatMap(versionToken);
  return parts
    .join(' ')
    .replace(new RegExp(`(\\s*${SEGMENT}\\s*)+`, 'g'), ` ${SEGMENT} `)
    .replace(new RegExp(`^\\s*${SEGMENT}\\s*|\\s*${SEGMENT}\\s*$`, 'g'), '')
    .trim();
}

/**
 * For large headings only: keeps "·" with the word before it, a count with its unit and a code
 * like "GR-S" in one piece, so a line never starts with "·" or splits "7 asientos". A word joiner
 * follows the hyphen because the font has no non-breaking hyphen. The data keeps plain spaces and
 * hyphens, which search relies on.
 */
export function unbreakableVersionSegments(version: string) {
  return version
    .replaceAll(` ${SEGMENT} `, `\u00a0${SEGMENT} `)
    .replace(/(\d) (asientos|puertas|CV|HP)\b/g, '$1\u00a0$2')
    .replace(/(\w)-(\w)/g, '$1-\u2060$2');
}

// The seller ends most descriptions with "Gonba's Garage / Compra - venta - consignación", with a
// straight or typographic apostrophe. The site already says who is selling.
const DESCRIPTION_SIGN_OFF =
  /\s*Gonba[’'‘`´]?s\s+Garage\s*\n\s*Compra\s*[-–—]\s*venta\s*[-–—]\s*consignaci[oó]n\.?\s*$/i;

/** The seller's text stays verbatim except for the repeated sign-off at the end. */
export function cleanVehicleDescription(description: string) {
  return description.replace(DESCRIPTION_SIGN_OFF, '').trimEnd();
}

type AttributeLookup = (id: string) => MercadoLibreAttribute | undefined;
type Highlight = { label: string; matches: (attribute: AttributeLookup) => boolean };

const isYes = (attribute?: MercadoLibreAttribute) => attribute?.value_name?.trim().toLocaleLowerCase('es') === 'sí';
const has = (id: string, label: string): Highlight => ({ label, matches: attribute => isYes(attribute(id)) });

// Most telling first. Equipment almost every car has (ABS, air conditioning, alloy wheels) only
// fills the slots that remain; airbags never show, since every car has them.
const HIGHLIGHTS: Highlight[] = [
  has('SINGLE_OWNER', 'Único dueño'),
  {
    label: 'Tracción 4x4',
    matches: attribute => /^(4x4|4wd|awd|integral)$/i.test(attribute('TRACTION_CONTROL')?.value_name?.trim() ?? ''),
  },
  ...[7, 8, 9].map((seats): Highlight => ({
    label: `${seats} asientos`,
    matches: attribute => Number.parseInt(attribute('PASSENGER_CAPACITY')?.value_name ?? '', 10) === seats,
  })),
  has('HAS_SLIDING_ROOF', 'Techo solar'),
  has('HAS_LEATHER_UPHOLSTERY', 'Tapizado de cuero'),
  has('HAS_SEMI_LEATHER_UPHOLSTERY', 'Tapizado de semicuero'),
  has('HAS_XENON_HEADLIGHTS', 'Faros de xenón'),
  has('HAS_GPS', 'GPS'),
  has('HAS_APPLE_CARPLAY', 'Apple CarPlay'),
  has('HAS_ANDROID_AUTO', 'Android Auto'),
  has('HAS_PARKING_SENSOR', 'Sensor de estacionamiento'),
  // Only when the car does not already list a parking sensor, which covers the rear one.
  {
    label: 'Sensor de estacionamiento trasero',
    matches: attribute => isYes(attribute('HAS_REAR_PARKING_SENSOR')) && !isYes(attribute('HAS_PARKING_SENSOR')),
  },
  has('HAS_CURTAIN_AIRBAG', 'Airbags de cortina'),
  has('HAS_RAIN_SENSOR', 'Sensor de lluvia'),
  has('HAS_AUTOPILOT', 'Piloto automático'),
  has('HAS_BLUETOOTH', 'Bluetooth'),
  has('HAS_ALLOY_WHEELS', 'Llantas de aleación'),
  has('HAS_AIR_CONDITIONING', 'Aire acondicionado'),
  has('HAS_ABS_BRAKES', 'Frenos ABS'),
];

export const MAX_VEHICLE_HIGHLIGHTS = 6;

/** "Puntos destacados": up to six, preferring what tells this car apart from the others. */
export function pickVehicleHighlights(attributes: MercadoLibreAttribute[]) {
  const attribute = (id: string) => attributes.find(candidate => candidate.id === id);
  return HIGHLIGHTS.filter(({ matches }) => matches(attribute))
    .map(({ label }) => label)
    .slice(0, MAX_VEHICLE_HIGHLIGHTS);
}

/** The vehicle as pages show it. Highlights need the attributes, which only a single publication carries. */
export function cleanCatalogVehicle(vehicle: Vehicle, attributes?: MercadoLibreAttribute[]): Vehicle {
  const version = formatVehicleVersion(vehicle.version);
  return {
    ...vehicle,
    version,
    // Photos are named as the headings name the car, not by the publication title as typed in
    // Mercado Libre ("Mercedes-benz Clase A", "Toyota Sw4 2.8 Tdi Gr-s").
    imageAlt: [vehicle.make, vehicle.model, version].filter(Boolean).join(' '),
    description: cleanVehicleDescription(vehicle.description),
    ...(attributes?.length ? { highlights: pickVehicleHighlights(attributes) } : {}),
  };
}
