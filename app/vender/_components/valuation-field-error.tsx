import { CircleAlert } from 'lucide-react';

import { fieldErrorId } from './valuation-validation';

export function ValuationFieldError({ field, message }: { field: string; message: string | undefined }) {
  if (!message) return null;

  // Read through the control's aria-describedby. aria-hidden keeps it out of the wrapping label's accessible name.
  return (
    <small className="valuation-field-error" id={fieldErrorId(field)} aria-hidden="true">
      <CircleAlert size={14} strokeWidth={2} />
      {message}
    </small>
  );
}
