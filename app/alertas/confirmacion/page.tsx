import type { Metadata } from 'next';
import { ArrowUpRight } from 'lucide-react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { StatusSteps } from '@/components/ui/status';
import { WHATSAPP_CATALOG_MESSAGE } from '@/constants/contact';
import { confirmationLifetimeHours, alertEmailsConfigured } from '@/lib/alerts/config';
import { getWhatsAppUrl } from '@/lib/contact';
import { createPageMetadata } from '@/lib/metadata';
import { AlertResultMotion } from './_components/alert-result-motion';

// Where /api/alerts/confirm sends people after the emailed link. Never indexed in any mode.
export const metadata: Metadata = {
  ...createPageMetadata({
    title: "Confirmación de alerta | Gonba's Garage",
    description: "Resultado de la confirmación de una alerta de Gonba's Garage.",
    path: '/alertas/confirmacion',
  }),
  robots: { index: false, follow: false },
};

type Result = {
  eyebrow: string;
  title: string;
  text: string;
  steps?: string[];
  actions: { label: string; href: string; external?: boolean }[];
};

const browse = { label: 'Ver vehículos', href: '/vehiculos' };
const home = { label: 'Ir al inicio', href: '/' };

const failures: Record<string, Result> = {
  vencido: {
    eyebrow: 'Enlace vencido',
    title: 'Este enlace ya venció.',
    text: `Los enlaces de confirmación duran ${confirmationLifetimeHours} horas. Creá la alerta de nuevo y te enviaremos uno nuevo.`,
    actions: [browse, home],
  },
  error: {
    eyebrow: 'Algo salió mal',
    title: 'No pudimos confirmar tu alerta.',
    text: 'Tuvimos un problema temporal. Volvé a abrir el enlace del email en unos minutos.',
    actions: [browse, home],
  },
  'no-valido': {
    eyebrow: 'Enlace no válido',
    title: 'No pudimos validar este enlace.',
    text: 'Puede que esté incompleto, o que la alerta haya sido cancelada o reemplazada. Podés crearla de nuevo desde el sitio.',
    actions: [browse, home],
  },
};

function confirmed(type: string | undefined, vehicleSlug: string | undefined): Result {
  if (type === 'busqueda') {
    // Only where alert emails cannot be sent (an unconfigured preview): never promise them.
    if (!alertEmailsConfigured()) {
      return {
        eyebrow: 'Alerta confirmada',
        title: 'Guardamos tu búsqueda.',
        text: 'Por ahora no estamos enviando avisos de búsqueda por email. Si querés que te avisemos cuando entre algo así, escribinos por WhatsApp.',
        actions: [{ label: 'Escribinos por WhatsApp', href: getWhatsAppUrl(WHATSAPP_CATALOG_MESSAGE), external: true }, browse],
      };
    }
    return {
      eyebrow: 'Alerta confirmada',
      title: 'La búsqueda queda en nuestras manos.',
      text: 'Tu alerta ya está activa. Te escribiremos cuando ingrese una unidad que coincida con tus criterios, o cuando vuelva a estar disponible una que estaba reservada.',
      steps: [
        'Revisamos cada auto que entra o vuelve a estar disponible.',
        'Si coincide, te avisamos por email, una sola vez por auto. Si son varios, van juntos.',
        'Cada aviso incluye un enlace para cancelar la alerta.',
      ],
      actions: [browse],
    };
  }
  const vehicle = vehicleSlug && /^[a-z0-9-]{1,160}$/i.test(vehicleSlug) ? `/vehiculos/${vehicleSlug}` : null;
  return {
    eyebrow: 'Alerta confirmada',
    title: 'Te avisaremos si baja.',
    text: 'Tu alerta de precio ya está activa. Seguimos la publicación y te escribimos cada vez que baje.',
    steps: [
      'Te enviamos un email con el precio de referencia.',
      'Revisamos el precio todos los días.',
      'Cada aviso incluye un enlace para cancelar la alerta.',
    ],
    actions: vehicle ? [{ label: 'Volver al vehículo', href: vehicle }, { label: 'Ver más vehículos', href: '/vehiculos' }] : [browse],
  };
}

const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function AlertConfirmationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const state = single(params.estado);
  const result = state === 'confirmada'
    ? confirmed(single(params.tipo), single(params.vehiculo))
    : failures[state ?? ''] ?? failures['no-valido'];

  return (
    <div className="alert-result-page" id="alert-result-top">
      <SiteHeader />

      <main className="section-shell alert-result-layout">
        <AlertResultMotion labelledBy="alert-result-title">
          <Eyebrow>{result.eyebrow}</Eyebrow>
          <h1 id="alert-result-title">{result.title}</h1>
          <p>{result.text}</p>
          {result.steps && <StatusSteps steps={result.steps} />}
          <div className="status-actions">
            {result.actions.map((action, index) => action.external ? (
              <ButtonAnchor key={action.href} href={action.href} rel="noreferrer" target="_blank" variant={index === 0 ? 'accent' : 'glass'}>
                {action.label} {index === 0 && <ArrowUpRight aria-hidden="true" size={16} />}
              </ButtonAnchor>
            ) : (
              <ButtonLink key={action.href} href={action.href} variant={index === 0 ? 'accent' : 'glass'}>
                {action.label} {index === 0 && <ArrowUpRight aria-hidden="true" size={16} />}
              </ButtonLink>
            ))}
          </div>
        </AlertResultMotion>
      </main>

      <SiteFooter topHref="#alert-result-top" />
    </div>
  );
}
