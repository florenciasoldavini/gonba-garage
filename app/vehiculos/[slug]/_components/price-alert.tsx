'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BellRing, CircleAlert, RotateCw, TrendingDown, WifiOff, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { PrivacyPolicyLink } from '@/components/ui/privacy-policy-link';
import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { postJson, type RequestFailure } from '@/lib/json-request';

type PriceAlertProps = {
  vehicleName: string;
  vehicleSlug: string;
  formattedPrice: string;
};

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function PriceAlert({ vehicleName, vehicleSlug, formattedPrice }: PriceAlertProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmissionState>('idle');
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const titleId = useId();
  const successTitleId = useId();
  const emailErrorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const { closeDialog, dialogRef, openDialog: animateDialogOpen } = useDialogMotion({
    contentKey: state === 'success' ? 'success' : undefined,
    itemSelector: '.price-alert-form > :not(.price-alert-honeypot)',
    panelSelector: '.price-alert-panel',
  });

  const openDialog = () => {
    setState('idle');
    setFailure(null);
    captureAnalyticsEvent('price_alert_opened', { vehicle_slug: vehicleSlug });
    requestAnimationFrame(animateDialogOpen);
  };

  // The submit button is disabled while sending, which drops focus to <body>. Put it back somewhere useful.
  useEffect(() => {
    if (failure) (failure.field === 'email' ? emailRef : submitRef).current?.focus();
  }, [failure]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');

    const form = new FormData(event.currentTarget);
    const result = await postJson('/api/price-alerts', {
      email,
      vehicleSlug,
      website: form.get('website'),
    });

    if (result.ok) {
      setState('success');
      captureAnalyticsEvent('price_alert_created', { vehicle_slug: vehicleSlug });
    } else {
      setState('error');
      setFailure(result.failure);
      captureAnalyticsEvent('price_alert_failed', { vehicle_slug: vehicleSlug });
    }
  };

  const shownFailure = state === 'error' ? failure : null;
  const emailInvalid = shownFailure?.field === 'email';
  const retry = shownFailure?.retryable === true;

  return (
    <>
      <button className="detail-alert-card" type="button" onClick={openDialog}>
        <span className="detail-alert-symbol" aria-hidden="true"><BellRing size={20} strokeWidth={2} /></span>
        <span className="detail-alert-copy">
          <strong>Avisame si baja</strong>
          <small>Recibí una alerta por email</small>
        </span>
        <span className="detail-alert-arrow" aria-hidden="true"><TrendingDown size={18} strokeWidth={1.8} /></span>
      </button>

      <dialog
        className="price-alert-dialog"
        ref={dialogRef}
        aria-labelledby={state === 'success' ? successTitleId : titleId}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="price-alert-panel glass-panel">
          <button className="price-alert-close" type="button" onClick={closeDialog} aria-label="Cerrar alerta de precio"><X aria-hidden="true" size={18} strokeWidth={1.8} /></button>

          {state === 'success' ? (
            <div className="price-alert-success" data-dialog-view aria-live="polite">
              <Eyebrow>Revisá tu email</Eyebrow>
              <h2 id={successTitleId}>Confirmá la alerta desde tu correo.</h2>
              {/* The API answers the same whether or not it sent an email (an active alert gets none). */}
              <p>Si es una alerta nueva, te enviamos un enlace para activar la alerta del {vehicleName}. Hasta que la confirmes no recibirás avisos. El precio actual es {formattedPrice}.</p>
              <div className="status-actions">
                <Button type="button" onClick={closeDialog}>Seguir viendo el auto <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} /></Button>
              </div>
            </div>
          ) : (
            <form className="price-alert-form ph-no-capture" data-dialog-view data-private onSubmit={handleSubmit}>
              <Eyebrow>Alerta de precio</Eyebrow>
              <h2 id={titleId}>¿Esperando una mejor oportunidad?</h2>
              <p>Dejanos tu email y te avisamos si el precio del {vehicleName} baja de {formattedPrice}.</p>

              <label>
                <span>Email</span>
                <input
                  ref={emailRef}
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  maxLength={320}
                  required
                  aria-invalid={emailInvalid || undefined}
                  aria-describedby={emailInvalid ? emailErrorId : undefined}
                />
              </label>
              {emailInvalid && (
                <p className="price-alert-field-error" id={emailErrorId} role="alert">
                  <CircleAlert aria-hidden="true" size={15} strokeWidth={2} />{shownFailure.title}
                </p>
              )}

              <label className="price-alert-honeypot" aria-hidden="true">
                <span>Sitio web</span>
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>

              <Button ref={submitRef} type="submit" disabled={state === 'submitting'}>
                <span>{state === 'submitting' ? 'Enviando…' : retry ? 'Reintentar' : 'Crear alerta'}</span>
                {retry
                  ? <RotateCw aria-hidden="true" size={16} strokeWidth={1.8} />
                  : <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />}
              </Button>
              {shownFailure && !emailInvalid && (
                <div className="price-alert-error" role="alert">
                  {shownFailure.kind === 'connection'
                    ? <WifiOff aria-hidden="true" size={18} strokeWidth={2} />
                    : <CircleAlert aria-hidden="true" size={18} strokeWidth={2} />}
                  <p><strong>{shownFailure.title}</strong>{shownFailure.detail && <span>{shownFailure.detail}</span>}</p>
                </div>
              )}
              <p className="price-alert-privacy">Te avisaremos de cada nueva baja de esta unidad. Podés cancelar la alerta desde cualquier correo. Al suscribirte aceptás la <PrivacyPolicyLink />.</p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
