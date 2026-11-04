import { RetryButton } from '@/components/status/retry-button';
import { StuckDoorPage } from '@/components/status/stuck-door';

/**
 * Shown when the live catalog backend fails. The catalog header is left out on purpose: it would
 * announce an inventory that is not there and compete with the message.
 */
export function CatalogUnavailable({ title }: { title: string }) {
  return (
    <StuckDoorPage
      active="vehicles"
      eyebrow="Catálogo no disponible"
      title={title}
      text="El problema es nuestro, no de tu conexión. Probá de nuevo en unos segundos o escribinos por WhatsApp y te contamos qué autos hay disponibles."
      action={<RetryButton />}
    />
  );
}
