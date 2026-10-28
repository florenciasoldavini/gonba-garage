import { NextResponse } from 'next/server';

import { isAlertsDatabaseConfigured } from '@/lib/alerts/database';
import { saveInventorySubscription } from '@/lib/alerts/subscriptions';

type InventoryAlertRequest = {
  email?: unknown;
  website?: unknown;
  query?: unknown;
  make?: unknown;
  transmission?: unknown;
  bodyType?: unknown;
  fuel?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
  minMileage?: unknown;
  maxMileage?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedTransmissions = new Set(['', 'automatic', 'manual']);

function normalizeText(value: unknown, maximumLength: number) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || value.length > maximumLength) return null;
  return value.trim();
}

function normalizeBound(value: unknown, maximum: number) {
  if (value === null || value === undefined || value === '') return 0;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > maximum
  ) return null;
  return value;
}

export async function POST(request: Request) {
  let body: InventoryAlertRequest;

  try {
    body = await request.json() as InventoryAlertRequest;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch {
    return NextResponse.json({ message: 'La solicitud no es válida.' }, { status: 400 });
  }

  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const normalizedEmail = normalizeText(body.email, 320);
  const email = normalizedEmail === null ? null : normalizedEmail.toLocaleLowerCase('es');
  const query = normalizeText(body.query, 120);
  const make = normalizeText(body.make, 80);
  const transmission = normalizeText(body.transmission, 20);
  const bodyType = normalizeText(body.bodyType, 80);
  const fuel = normalizeText(body.fuel, 80);
  const minPrice = normalizeBound(body.minPrice, 9_999_999_999);
  const maxPrice = normalizeBound(body.maxPrice, 9_999_999_999);
  const minMileage = normalizeBound(body.minMileage, 2_147_483_647);
  const maxMileage = normalizeBound(body.maxMileage, 2_147_483_647);

  if (
    email === null ||
    query === null ||
    make === null ||
    transmission === null ||
    bodyType === null ||
    fuel === null ||
    !emailPattern.test(email) ||
    !allowedTransmissions.has(transmission) ||
    minPrice === null ||
    maxPrice === null ||
    minMileage === null ||
    maxMileage === null ||
    (maxPrice > 0 && maxPrice < minPrice) ||
    (maxMileage > 0 && maxMileage < minMileage)
  ) {
    return NextResponse.json(
      { message: 'Revisá el email y los criterios de búsqueda.' },
      { status: 400 },
    );
  }

  if (!isAlertsDatabaseConfigured()) {
    return NextResponse.json({ message: 'Las alertas no están disponibles por el momento.' }, { status: 503 });
  }

  try {
    await saveInventorySubscription({ email, query, make, transmission, bodyType, fuel,
      minPrice, maxPrice, minMileage, maxMileage });
  } catch {
    console.error('Unable to create inventory alert');
    return NextResponse.json(
      { message: 'No pudimos guardar la alerta. Probá otra vez.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
