import { NextResponse } from 'next/server';

import { findMockVehicle } from '@/features/vehicles/data/mock-vehicles';
import { createAdminClient } from '@/lib/supabase/admin';

type PriceAlertRequest = {
  email?: unknown;
  vehicleSlug?: unknown;
  website?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: PriceAlertRequest;

  try {
    body = await request.json() as PriceAlertRequest;
  } catch {
    return NextResponse.json({ message: 'La solicitud no es válida.' }, { status: 400 });
  }

  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLocaleLowerCase('es') : '';
  const vehicleSlug = typeof body.vehicleSlug === 'string' ? body.vehicleSlug.trim() : '';
  const vehicle = findMockVehicle(vehicleSlug);

  if (!vehicle || !emailPattern.test(email) || email.length > 320) {
    return NextResponse.json(
      { message: 'Revisá el email e intentá nuevamente.' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('vehicle_price_alerts')
    .upsert(
      {
        vehicle_slug: vehicle.slug,
        email,
        current_price: vehicle.price,
        currency: vehicle.currency,
        status: 'active',
        source: 'website',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vehicle_slug,email' },
    );

  if (error) {
    console.error('Unable to create price alert', { code: error.code });
    return NextResponse.json(
      { message: 'No pudimos guardar la alerta. Probá otra vez.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
