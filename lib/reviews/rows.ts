import 'server-only';
import { integer, oneOf, optionalText, text, timestamp, uuid, type Row } from '@/lib/database-rows';
import type { TransactionType } from './submission';

const TRANSACTION_TYPES: readonly TransactionType[] = ['bought', 'sold'];

export type Review = {
  id: string;
  transactionType: TransactionType;
  rating: number;
  comment: string;
  displayName: string;
  vehicle: string | null;
  /** ISO 8601: the home page reads reviews from a cache that stores them as JSON. */
  createdAt: string;
};

export function parseReview(row: Row): Review {
  return {
    id: uuid(row.id, 'id'),
    transactionType: oneOf(TRANSACTION_TYPES, row.transaction_type, 'transaction_type'),
    rating: integer(row.rating, 'rating'),
    comment: text(row.comment, 'comment'),
    displayName: text(row.display_name, 'display_name'),
    vehicle: optionalText(row.vehicle, 'vehicle'),
    createdAt: timestamp(row.created_at, 'created_at').toISOString(),
  };
}
