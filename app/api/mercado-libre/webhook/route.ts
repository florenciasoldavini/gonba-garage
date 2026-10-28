import { NextResponse } from 'next/server';

type MercadoLibreNotification = {
  topic?: unknown;
  resource?: unknown;
  user_id?: unknown;
  application_id?: unknown;
};

export async function POST(request: Request) {
  let notification: MercadoLibreNotification;

  try {
    notification = await request.json() as MercadoLibreNotification;
  } catch {
    return NextResponse.json(
      { ok: false },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
  }

  console.info('Mercado Libre test notification acknowledged', {
    topic: typeof notification.topic === 'string' ? notification.topic : null,
    resource: typeof notification.resource === 'string' ? notification.resource : null,
    userId: typeof notification.user_id === 'number' ? notification.user_id : null,
    applicationId:
      typeof notification.application_id === 'number' ? notification.application_id : null,
  });

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
