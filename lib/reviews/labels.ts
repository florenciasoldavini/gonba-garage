import type { TransactionType } from './submission';

const monthFormat = new Intl.DateTimeFormat('es-AR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** "Compró · Toyota SW4", or "Compró un auto" when the customer left the car out. */
export function reviewDealLabel({
  transactionType,
  vehicle,
}: {
  transactionType: TransactionType;
  vehicle: string | null;
}) {
  const bought = transactionType === 'bought';
  if (vehicle) return `${bought ? 'Compró' : 'Vendió'} · ${vehicle}`;
  return bought ? 'Compró un auto' : 'Vendió su auto';
}

/** "oct 2026". The parts, because the whole format's punctuation varies with the runtime's locale data. */
export function reviewDateLabel(createdAt: string) {
  const parts = monthFormat.formatToParts(new Date(createdAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(entry => entry.type === type)?.value ?? '';
  return `${part('month').replace('.', '')} ${part('year')}`;
}
