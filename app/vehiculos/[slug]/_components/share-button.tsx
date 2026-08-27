'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';

import { captureAnalyticsEvent } from '@/lib/analytics/client';

type ShareButtonProps = {
  title: string;
  text: string;
  fallbackUrl: string;
  vehicleSlug: string;
};

export function ShareButton({ title, text, fallbackUrl, vehicleSlug }: ShareButtonProps) {
  const [feedback, setFeedback] = useState('');

  const copyLink = async (url: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }

    const input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();

    if (!copied) throw new Error('Copy command failed');
  };

  const handleShare = async () => {
    const url = window.location.href || fallbackUrl;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        captureAnalyticsEvent('vehicle_shared', { method: 'native', vehicle_slug: vehicleSlug });
        setFeedback('Compartido');
        return;
      }

      await copyLink(url);
      captureAnalyticsEvent('vehicle_shared', { method: 'clipboard', vehicle_slug: vehicleSlug });
      setFeedback('Enlace copiado');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      setFeedback('No se pudo compartir');
    }
  };

  return (
    <button
      className="detail-share-button"
      type="button"
      onClick={handleShare}
      aria-label={`Compartir ${title}`}
    >
      <span aria-live="polite">{feedback || 'Compartir'}</span>
      <Share2 aria-hidden="true" size={14} strokeWidth={1.8} />
    </button>
  );
}
