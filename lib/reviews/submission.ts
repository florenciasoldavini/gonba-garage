/**
 * What a customer may submit at /opinar. The form and the API run the same checks, so the form's
 * messages are the API's. A review is published without anyone reading it first, so this is what
 * keeps links, phone numbers and other people's contact details off the home page.
 */
export const COMMENT_MAX_LENGTH = 280;
export const NAME_MAX_LENGTH = 80;
export const VEHICLE_MAX_LENGTH = 60;

export type TransactionType = 'bought' | 'sold';
export type ReviewField = 'type' | 'rating' | 'comment' | 'name' | 'vehicle' | 'consent';
export type ReviewErrors = Partial<Record<ReviewField, string>>;

export type NewReview = {
  transactionType: TransactionType;
  rating: number;
  comment: string;
  displayName: string;
  vehicle: string | null;
};

const NAME_PATTERN = /^\p{L}[\p{L}\p{M}'’. -]*$/u;
const CONTACT_DETAILS = [
  /https?:\/\/|www\./i,
  /\b[\w-]+\.(?:ar|com|info|io|net|online|org|shop|site|store|xyz)\b/i,
  /[\w.+-]+@[\w-]+\./,
  /(?:\d[\s().-]*){9,}/,
];

const hasContactDetails = (value: string) => CONTACT_DETAILS.some(pattern => pattern.test(value));

/** One line of text: a card has no room for line breaks, and control characters never reach a page. */
function cleanText(value: unknown) {
  return typeof value === 'string'
    ? value
        .replace(/\p{Cc}+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

/** Keeps the capitals someone chose ("McKenzie"), and fixes a name typed all in one case. */
function capitalized(word: string) {
  if (word !== word.toLocaleLowerCase('es') && word !== word.toLocaleUpperCase('es')) return word;
  const [first = '', ...rest] = Array.from(word.toLocaleLowerCase('es'));
  return first.toLocaleUpperCase('es') + rest.join('');
}

/** "martín garcía lópez" becomes "Martín L.". Only this short form is stored or shown. */
export function reviewDisplayName(fullName: string) {
  const words = cleanText(fullName).split(' ');
  const firstName = capitalized(words[0]);
  const initial = words.length > 1 ? words.at(-1)?.match(/\p{L}/u)?.[0] : undefined;
  return initial ? `${firstName} ${initial.toLocaleUpperCase('es')}.` : firstName;
}

/** The fields are unknown because the API receives whatever was posted. */
export function validateReview(input: Record<string, unknown>) {
  const errors: ReviewErrors = {};
  const { type, rating, consent } = input;
  const comment = cleanText(input.comment);
  const name = cleanText(input.name);
  const vehicle = cleanText(input.vehicle);

  if (type !== 'bought' && type !== 'sold') errors.type = 'Elegí una opción.';
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5)
    errors.rating = 'Elegí una puntuación.';

  if (!comment) errors.comment = 'Contanos cómo te fue.';
  else if (comment.length > COMMENT_MAX_LENGTH) errors.comment = `Usá hasta ${COMMENT_MAX_LENGTH} caracteres.`;
  else if (hasContactDetails(comment)) errors.comment = 'Sacá los teléfonos y los links del comentario.';

  if (!name) errors.name = 'Escribí tu nombre.';
  else if (name.length > NAME_MAX_LENGTH || !NAME_PATTERN.test(name) || hasContactDetails(name))
    errors.name = 'Escribí solo tu nombre y apellido.';

  if (vehicle.length > VEHICLE_MAX_LENGTH) errors.vehicle = `Usá hasta ${VEHICLE_MAX_LENGTH} caracteres.`;
  else if (hasContactDetails(vehicle)) errors.vehicle = 'Escribí solo la marca y el modelo.';

  if (consent !== true) errors.consent = 'Necesitamos tu permiso para mostrarla.';

  if (Object.keys(errors).length > 0) return { ok: false as const, errors };
  const review: NewReview = {
    transactionType: type as TransactionType,
    rating: rating as number,
    comment,
    displayName: reviewDisplayName(name),
    vehicle: vehicle || null,
  };
  return { ok: true as const, review };
}
