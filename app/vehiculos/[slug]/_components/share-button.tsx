'use client';

import { useRef, useState } from 'react';
import { Check, Copy, Link2, Mail, MessageCircle, Share2, X } from 'lucide-react';

import { captureAnalyticsEvent } from '@/lib/analytics/client';

type ShareButtonProps = {
  title: string;
  text: string;
  fallbackUrl: string;
  vehicleSlug: string;
};

export function ShareButton({ title, text, fallbackUrl, vehicleSlug }: ShareButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [shareUrl, setShareUrl] = useState(fallbackUrl);
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

  const openDialog = () => {
    const url = window.location.href || fallbackUrl;
    setShareUrl(url);
    setFeedback('');
    dialogRef.current?.showModal();
  };

  const closeDialog = () => dialogRef.current?.close();

  const handleCopy = async () => {
    try {
      await copyLink(shareUrl);
      captureAnalyticsEvent('vehicle_shared', { method: 'clipboard', vehicle_slug: vehicleSlug });
      setFeedback('Enlace copiado');
    } catch {
      setFeedback('No se pudo copiar');
    }
  };

  const shareMessage = `${text}\n\n${shareUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareMessage)}`;

  return (
    <>
      <button
        className="detail-share-button"
        type="button"
        onClick={openDialog}
        aria-label={`Compartir ${title}`}
      >
        <span>Compartir</span>
        <Share2 aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>

      <dialog
        className="share-dialog"
        ref={dialogRef}
        aria-labelledby="share-dialog-title"
        aria-describedby="share-dialog-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="share-dialog-panel glass-panel">
          <button className="share-dialog-close" type="button" onClick={closeDialog} aria-label="Cerrar opciones para compartir">
            <X aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>

          <span className="share-dialog-icon" aria-hidden="true">
            <Share2 size={20} strokeWidth={1.9} />
          </span>
          <p className="share-dialog-kicker">Compartir vehículo</p>
          <h2 id="share-dialog-title">Compartí este auto.</h2>
          <p id="share-dialog-description">{text}</p>

          <div className="share-dialog-options">
            <a
              className="share-dialog-option share-dialog-option-primary"
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                captureAnalyticsEvent('vehicle_shared', { method: 'whatsapp', vehicle_slug: vehicleSlug });
                closeDialog();
              }}
            >
              <MessageCircle aria-hidden="true" size={18} strokeWidth={1.8} />
              <span><strong>WhatsApp</strong><small>Enviar por mensaje</small></span>
            </a>
            <a
              className="share-dialog-option"
              href={emailUrl}
              onClick={() => {
                captureAnalyticsEvent('vehicle_shared', { method: 'email', vehicle_slug: vehicleSlug });
                closeDialog();
              }}
            >
              <Mail aria-hidden="true" size={18} strokeWidth={1.8} />
              <span><strong>Correo</strong><small>Compartir por email</small></span>
            </a>
            <button className="share-dialog-option share-dialog-copy" type="button" onClick={handleCopy}>
              {feedback === 'Enlace copiado'
                ? <Check aria-hidden="true" size={18} strokeWidth={2} />
                : <Copy aria-hidden="true" size={18} strokeWidth={1.8} />}
              <span><strong>{feedback || 'Copiar enlace'}</strong><small>Guardarlo en el portapapeles</small></span>
            </button>
          </div>

          <div className="share-dialog-url">
            <Link2 aria-hidden="true" size={14} strokeWidth={1.8} />
            <span>{shareUrl}</span>
          </div>
        </div>
      </dialog>
    </>
  );
}
