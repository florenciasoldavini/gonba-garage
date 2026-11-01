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
export const BUSINESS_AREA = { locality: 'Villa Pueyrredón', region: 'CABA', country: 'AR' } as const;
export const BUSINESS_HOURS = ['Lunes a viernes de 10 a 18 h', 'Sábados de 10 a 13 h'] as const;
export const BUSINESS_VISIT_POLICY = 'Siempre con cita previa';
