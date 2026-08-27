'use client';

import { FormEvent, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BellRing, Check, TrendingDown, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

type PriceAlertProps = {
  vehicleName: string;
  vehicleSlug: string;
  formattedPrice: string;
};

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function PriceAlert({ vehicleName, vehicleSlug, formattedPrice }: PriceAlertProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');

  const openDialog = () => {
    setState('idle');
    setMessage('');
    captureAnalyticsEvent('price_alert_opened', { vehicle_slug: vehicleSlug });
    dialogRef.current?.showModal();
  };

  const closeDialog = () => dialogRef.current?.close();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');
    setMessage('');

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          vehicleSlug,
          website: form.get('website'),
        }),
      });

      const result = await response.json() as { message?: string };

      if (!response.ok) throw new Error(result.message || 'No pudimos guardar la alerta.');

      setState('success');
      captureAnalyticsEvent('price_alert_created', { vehicle_slug: vehicleSlug });
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar la alerta.');
      captureAnalyticsEvent('price_alert_failed', { vehicle_slug: vehicleSlug });
    }
  };

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
        aria-labelledby="price-alert-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="price-alert-panel glass-panel">
          <button className="price-alert-close" type="button" onClick={closeDialog} aria-label="Cerrar alerta de precio"><X aria-hidden="true" size={18} strokeWidth={1.8} /></button>

          {state === 'success' ? (
            <div className="price-alert-success" aria-live="polite">
              <span aria-hidden="true"><Check size={22} strokeWidth={2.2} /></span>
              <p>Alerta activada</p>
              <h2>Te avisaremos si baja.</h2>
              <p>Guardamos tu alerta para el {vehicleName}. El precio actual es {formattedPrice}.</p>
              <Button type="button" onClick={closeDialog}>Seguir viendo el auto <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} /></Button>
            </div>
          ) : (
            <form className="price-alert-form ph-no-capture" data-private onSubmit={handleSubmit}>
              <Eyebrow>Alerta de precio</Eyebrow>
              <h2 id="price-alert-title">¿Esperando una mejor oportunidad?</h2>
              <p>Dejanos tu email y te avisamos si el precio del {vehicleName} baja de {formattedPrice}.</p>

              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  maxLength={320}
                  required
                />
              </label>

              <label className="price-alert-honeypot" aria-hidden="true">
                <span>Sitio web</span>
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>

              <Button type="submit" disabled={state === 'submitting'}>
                <span>{state === 'submitting' ? 'Activando…' : 'Crear alerta'}</span>
                <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
              </Button>
              <p className="price-alert-privacy">Usaremos tu email únicamente para avisarte sobre esta unidad.</p>
              {state === 'error' && <p className="price-alert-error" role="alert">{message}</p>}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
