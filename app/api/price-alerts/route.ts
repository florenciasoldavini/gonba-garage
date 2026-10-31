import { after, NextResponse } from 'next/server';

import { findCatalogVehicle } from '@/lib/integrations/mercado-libre/catalog';
import { catalogAccessToken } from '@/lib/integrations/mercado-libre/access-token';
import { readMercadoLibrePublication } from '@/lib/integrations/mercado-libre/oauth';
import { isAlertsDatabaseConfigured } from '@/lib/alerts/database';
import { savePriceSubscription } from '@/lib/alerts/subscriptions';
import { alertDeliveryEnabled } from '@/lib/alerts/config';
import { reserveAlertSignup } from '@/lib/alerts/signup-limit';
import { requestPriceAlert } from '@/lib/alerts/price-delivery';
import { sendSignupConfirmationSafely } from '@/lib/alerts/confirmation';
import { rejectCrossSiteJson } from '@/lib/alerts/request-guard';

type PriceAlertRequest = {
  email?: unknown;
  vehicleSlug?: unknown;
  website?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const rejected = rejectCrossSiteJson(request);
  if (rejected) return rejected;

  let body: PriceAlertRequest;

  try {
    body = await request.json() as PriceAlertRequest;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
  } catch {
    return NextResponse.json({ message: 'La solicitud no es válida.' }, { status: 400 });
  }

  if (typeof body.website === 'string' && body.website.length > 0) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLocaleLowerCase('es') : '';
  const vehicleSlug = typeof body.vehicleSlug === 'string' ? body.vehicleSlug.trim() : '';

  // Check the length before the regex: it backtracks quadratically on long inputs.
  if (!vehicleSlug || vehicleSlug.length > 160 || email.length > 320 || !emailPattern.test(email)) {
    // `field` lets the form point at the input. Other 400s (e.g. a sold vehicle) are not about the email.
    const emailInvalid = email.length > 320 || !emailPattern.test(email);
    return NextResponse.json(
      { message: 'Revisá el email e intentá nuevamente.', ...(emailInvalid ? { field: 'email' } : {}) },
      { status: 400 },
    );
  }

  if (!isAlertsDatabaseConfigured()) {
    return NextResponse.json({ message: 'Las alertas no están disponibles por el momento.' }, { status: 503 });
  }

  try {
    if (!await reserveAlertSignup('price', email, request)) {
      return NextResponse.json({ message: 'Recibimos demasiadas solicitudes. Probá más tarde.' }, { status: 429 });
    }
    // Price/currency come from our catalog, never from client-supplied amounts.
    const deliveryEnabled = alertDeliveryEnabled();
    const id = vehicleSlug.match(/-(MLA\d+)$/i)?.[1]?.toUpperCase();
    if (deliveryEnabled && !id) return NextResponse.json({ message: 'El vehículo ya no está disponible.' }, { status: 400 });
    // The backend may serve a demo frontend. Resolve real subscriptions directly through Mercado Libre.
    const publication = deliveryEnabled ? await readMercadoLibrePublication(id!, await catalogAccessToken()) : null;
    if (publication && String(publication.source.seller_id) !== process.env.MERCADO_LIBRE_SELLER_ID) {
      return NextResponse.json({ message: 'El vehículo ya no está disponible.' }, { status: 400 });
    }
    const vehicle = publication?.vehicle ?? await findCatalogVehicle(vehicleSlug);
    if (!vehicle || vehicle.status !== 'active') {
      return NextResponse.json({ message: 'El vehículo ya no está disponible.' }, { status: 400 });
    }
    if (alertDeliveryEnabled()) {
      // Pending until the owner confirms by email. The response does not reveal which case applied.
      const alert = await requestPriceAlert(email, vehicle);
      if (alert.status === 'pending') after(() => sendSignupConfirmationSafely({ scope: 'price', id: alert.id, generation: alert.generation, email, title: alert.vehicle_title }));
    } else {
      await savePriceSubscription({ email, vehicleSlug: vehicle.slug, price: vehicle.price, currency: vehicle.currency });
    }
  } catch {
    console.error('Unable to create price alert');
    return NextResponse.json(
      { message: 'No pudimos guardar la alerta. Probá otra vez.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
