'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail, MessageCircle, Share2, X } from 'lucide-react';

import { Eyebrow } from '@/components/ui/eyebrow';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

type ShareButtonProps = {
  fallbackUrl: string;
  imageSrc: string;
  text: string;
  title: string;
  vehicleMeta: string;
  vehicleSlug: string;
};

export function ShareButton({ fallbackUrl, imageSrc, text, title, vehicleMeta, vehicleSlug }: ShareButtonProps) {
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
          <div className="share-dialog-preview">
            <Image src={imageSrc} alt="" fill sizes="(max-width: 700px) 100vw, 360px" className="cover-image" />
            <div className="share-dialog-preview-overlay" />
            <span className="share-dialog-status"><i /> Disponible</span>
            <div className="share-dialog-vehicle">
              <p>{vehicleMeta}</p>
              <h2>{title}</h2>
            </div>
          </div>

          <div className="share-dialog-content">
            <button className="share-dialog-close" type="button" onClick={closeDialog} aria-label="Cerrar opciones para compartir">
              <X aria-hidden="true" size={18} strokeWidth={1.8} />
            </button>

            <Eyebrow>Pasalo</Eyebrow>
            <h2 id="share-dialog-title">Hay autos que piden ser compartidos.</h2>
            <p id="share-dialog-description">Mandáselo a esa persona que sabés que lo va a entender.</p>

            <div className="share-dialog-routes">
            <a
              className="share-dialog-route share-dialog-route-primary"
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                captureAnalyticsEvent('vehicle_shared', { method: 'whatsapp', vehicle_slug: vehicleSlug });
                closeDialog();
              }}
            >
              <MessageCircle aria-hidden="true" size={18} strokeWidth={1.8} />
              <span><small>01 · Enviar ahora</small><strong>WhatsApp</strong></span>
              <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
            </a>
              <div className="share-dialog-secondary-routes">
                <a
                  className="share-dialog-route"
                  href={emailUrl}
                  onClick={() => {
                    captureAnalyticsEvent('vehicle_shared', { method: 'email', vehicle_slug: vehicleSlug });
                    closeDialog();
                  }}
                >
                  <Mail aria-hidden="true" size={17} strokeWidth={1.8} />
                  <span><small>02</small><strong>Correo</strong></span>
                </a>
                <button className="share-dialog-route" type="button" onClick={handleCopy}>
                  {feedback === 'Enlace copiado'
                    ? <Check aria-hidden="true" size={17} strokeWidth={2} />
                    : <Copy aria-hidden="true" size={17} strokeWidth={1.8} />}
                  <span><small>03</small><strong>{feedback || 'Copiar link'}</strong></span>
                </button>
              </div>
            </div>

            <p className="share-dialog-signature">GONBA&apos;S <span>GARAGE</span></p>
          </div>
        </div>
      </dialog>
    </>
  );
}
