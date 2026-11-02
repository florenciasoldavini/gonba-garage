export const INSTAGRAM_URL = 'https://www.instagram.com/gonbagarage/';
export const WHATSAPP_APPOINTMENT_MESSAGE = "Hola, quiero coordinar una cita para visitar Gonba's Garage.";
export const WHATSAPP_CATALOG_MESSAGE = "Hola, estoy buscando un auto que no encontré en el catálogo de Gonba's Garage.";
export const WHATSAPP_GENERAL_MESSAGE = "Hola, quiero hacer una consulta a Gonba's Garage.";
export const WHATSAPP_NUMBER = '5491144148316';
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
export const WHATSAPP_DISPLAY_NUMBER = '+54 9 11 4414-8316';
export const WHATSAPP_PRIVACY_MESSAGE = "Hola, quiero hacer una consulta sobre mis datos personales en Gonba's Garage.";

// Confirmed by the owner. Visits are by appointment only and there is no public street address,
// so never publish one or present these hours as walk-in hours.
// The area and schedule are also part of the legal text (constants/legal.ts): changing the area
// revises /terminos and /privacidad, and changing the schedule revises /terminos. Bump
// LEGAL_PAGES.terms.updatedAt and LEGAL_PAGES.privacy.updatedAt to match.
export const BUSINESS_AREA = {
  locality: 'Villa Pueyrredón',
  region: 'CABA',
  regionName: 'Ciudad Autónoma de Buenos Aires',
  country: 'AR',
} as const;
// `days` is a range (first and last day) or a single weekday, in plural.
export const BUSINESS_SCHEDULE = [
  { days: ['lunes', 'viernes'], opens: 10, closes: 18 },
  { days: ['sábados'], opens: 10, closes: 13 },
] as const;
export const BUSINESS_HOURS = BUSINESS_SCHEDULE.map(({ days, opens, closes }) => {
  const label = days.join(' a ');
  return `${label[0].toUpperCase()}${label.slice(1)} de ${opens} a ${closes} h`;
});
export const BUSINESS_VISIT_POLICY = 'Siempre con cita previa';
