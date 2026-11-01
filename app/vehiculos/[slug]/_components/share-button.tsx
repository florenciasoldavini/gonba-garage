'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, Copy, Mail, MessageCircle, Share2, X } from 'lucide-react';

import { Eyebrow } from '@/components/ui/eyebrow';
import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

type ShareButtonProps = {
  fallbackUrl: string;
  imageSrc: string;
  text: string;
  title: string;
  vehicleMeta: string;
  vehicleSlug: string;
  statusLabel: string;
};

type CopyFeedback = 'idle' | 'copied' | 'failed';

const feedbackResetDelay = 4000;

// iOS ignores select() on read-only inputs, so set the range explicitly as well.
const selectAll = (input: HTMLInputElement) => {
  input.select();
  input.setSelectionRange(0, input.value.length);
};

export function ShareButton({ fallbackUrl, imageSrc, statusLabel, text, title, vehicleMeta, vehicleSlug }: ShareButtonProps) {
  const [shareUrl, setShareUrl] = useState(fallbackUrl);
  const [feedback, setFeedback] = useState<CopyFeedback>('idle');
  const [failure, setFailure] = useState({ message: '', hint: '' });
  const [canNativeShare, setCanNativeShare] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const { closeDialog, dialogRef, openDialog: animateDialogOpen } = useDialogMotion({
    itemSelector: '.share-dialog-content > :not(.share-dialog-close), .share-dialog-vehicle > *',
    panelSelector: '.share-dialog-panel',
  });

  useEffect(() => () => window.clearTimeout(feedbackTimerRef.current), []);

  // On short phones the dialog scrolls; keep the manual-copy hint on screen with the selected link.
  useEffect(() => {
    if (feedback === 'failed') feedbackRef.current?.scrollIntoView({ block: 'nearest' });
  }, [feedback, failure]);

  const shareData = (url: string) => ({ title, text, url });

  const showFeedback = (next: CopyFeedback) => {
    window.clearTimeout(feedbackTimerRef.current);
    setFeedback(next);
    if (next === 'copied') {
      feedbackTimerRef.current = window.setTimeout(() => setFeedback('idle'), feedbackResetDelay);
    }
  };

  // When the browser cannot write to the clipboard, hand the link over for a manual copy.
  const selectLinkForManualCopy = (message: string) => {
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    setFailure({
      message,
      hint: isTouch
        ? 'El enlace ya está seleccionado: mantené presionado y elegí «Copiar».'
        : 'El enlace ya está seleccionado: presioná ⌘C o Ctrl+C.',
    });
    showFeedback('failed');
    const input = linkInputRef.current;
    if (!input) return;
    input.focus();
    selectAll(input);
  };

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
    showFeedback('idle');
    setCanNativeShare(typeof navigator.share === 'function' && (navigator.canShare?.(shareData(url)) ?? true));
    animateDialogOpen();
  };

  const handleCopy = async () => {
    try {
      await copyLink(shareUrl);
      captureAnalyticsEvent('vehicle_shared', { method: 'clipboard', vehicle_slug: vehicleSlug });
      showFeedback('copied');
    } catch {
      selectLinkForManualCopy('No pudimos copiarlo automáticamente.');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share(shareData(shareUrl));
      captureAnalyticsEvent('vehicle_shared', { method: 'native', vehicle_slug: vehicleSlug });
      closeDialog();
    } catch (error) {
      // Closing the share sheet without picking an app is not an error worth reporting.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      selectLinkForManualCopy('No se pudo abrir el menú para compartir.');
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
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="share-dialog-panel glass-panel">
          <div className="share-dialog-preview">
            <Image src={imageSrc} alt="" fill sizes="(max-width: 700px) 100vw, 360px" className="cover-image" />
            <div className="share-dialog-preview-overlay" />
            <span className="share-dialog-status"><i /> {statusLabel}</span>
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
              <div className={`share-dialog-secondary-routes${canNativeShare ? '' : ' share-dialog-secondary-routes-single'}`}>
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
                {canNativeShare ? (
                  <button className="share-dialog-route" type="button" onClick={handleNativeShare}>
                    <Share2 aria-hidden="true" size={17} strokeWidth={1.8} />
                    <span><small>03</small><strong>Más apps</strong></span>
                  </button>
                ) : null}
              </div>

              <div className="share-dialog-link">
                <label htmlFor="share-dialog-link-input">{canNativeShare ? '04' : '03'} · Enlace del auto</label>
                <div className="share-dialog-link-row">
                  <input
                    ref={linkInputRef}
                    id="share-dialog-link-input"
                    type="url"
                    value={shareUrl}
                    readOnly
                    spellCheck={false}
                    onFocus={(event) => selectAll(event.currentTarget)}
                    onClick={(event) => selectAll(event.currentTarget)}
                  />
                  <button
                    className="share-dialog-copy"
                    type="button"
                    aria-label="Copiar enlace"
                    title="Copiar enlace"
                    onClick={handleCopy}
                  >
                    <Copy aria-hidden="true" size={18} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>

            <div ref={feedbackRef} className={`share-dialog-feedback is-${feedback}`} role="status">
              {feedback === 'copied' ? (
                <p><Check aria-hidden="true" size={16} strokeWidth={2} /> Enlace copiado. Ya podés pegarlo donde quieras.</p>
              ) : null}
              {feedback === 'failed' ? (
                <>
                  <p><AlertCircle aria-hidden="true" size={16} strokeWidth={1.8} /> {failure.message}</p>
                  <p className="share-dialog-feedback-hint">{failure.hint}</p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
