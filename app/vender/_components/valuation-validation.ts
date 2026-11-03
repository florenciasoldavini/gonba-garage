export type ValuationField = 'make' | 'model' | 'year' | 'version' | 'color' | 'mileage' | 'condition' | 'name';
export type ValuationErrors = Partial<Record<ValuationField, string>>;

const stepFields: Record<number, ValuationField[]> = {
  1: ['make', 'model', 'year', 'version', 'color'],
  2: ['mileage', 'condition'],
  3: ['name'],
};

type FieldCopy = {
  /** Nothing picked in a catalog select (a hidden input), or nothing typed. */
  missing: string;
  /** Nothing typed in the hand-written fallback of a catalog select. */
  missingTyped?: string;
  invalid?: (control: HTMLInputElement) => string;
};

const fieldCopy: Record<ValuationField, FieldCopy> = {
  make: { missing: 'Elegí la marca.', missingTyped: 'Escribí la marca.' },
  model: { missing: 'Elegí el modelo.', missingTyped: 'Escribí el modelo.' },
  year: {
    missing: 'Elegí el año.',
    missingTyped: 'Escribí el año.',
    invalid: control => `Ingresá un año entre ${control.min} y ${control.max}.`,
  },
  version: { missing: 'Elegí la versión.', missingTyped: 'Escribí la versión.' },
  color: { missing: 'Ingresá el color.' },
  mileage: {
    missing: 'Ingresá el kilometraje.',
    invalid: () => 'Revisá el kilometraje. Usá solo números, sin decimales.',
  },
  condition: { missing: 'Elegí el estado general.' },
  name: { missing: 'Ingresá tu nombre.' },
};

/** Our own copy for a required field, so the browser's validation bubble never shows. */
function getFieldError(form: HTMLFormElement, field: ValuationField) {
  const control = form.elements.namedItem(field);
  if (!(control instanceof HTMLInputElement)) return null;

  const copy = fieldCopy[field];
  // A number input holding text reports an empty value, so check badInput before treating it as missing.
  if (control.validity.badInput) return copy.invalid?.(control) ?? copy.missing;
  if (!control.value.trim()) return control.type === 'hidden' ? copy.missing : (copy.missingTyped ?? copy.missing);
  if (!control.checkValidity()) return copy.invalid?.(control) ?? copy.missing;
  return null;
}

export function getStepErrors(form: HTMLFormElement, step: number) {
  const errors: ValuationErrors = {};
  for (const field of stepFields[step] ?? []) {
    const message = getFieldError(form, field);
    if (message) errors[field] = message;
  }
  return errors;
}

/** Re-checks only the fields already showing an error, so fixing one clears it without flagging untouched fields. */
export function recheckErrors(form: HTMLFormElement, errors: ValuationErrors) {
  const next: ValuationErrors = {};
  for (const field of Object.keys(errors) as ValuationField[]) {
    const message = getFieldError(form, field);
    if (message) next[field] = message;
  }
  return next;
}

export const fieldErrorId = (field: string) => `valuation-${field}-error`;

/** Ties a control to its error message. Works on inputs and on `CustomSelect`. */
export function fieldErrorProps(field: string, message: string | undefined) {
  return message ? { 'aria-invalid': true as const, 'aria-describedby': fieldErrorId(field) } : {};
}
