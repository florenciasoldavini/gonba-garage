'use client';

import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BellRing, CircleAlert, RotateCw, WifiOff, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { useDialogMotion } from '@/components/motion/use-dialog-motion';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { postJson, type RequestFailure } from '@/lib/json-request';

export type InventoryAlertCriteria = {
  query: string;
  make: string;
  transmission: string;
  bodyType: string;
  fuel: string;
  minPrice: number | null;
  maxPrice: number | null;
  minMileage: number | null;
  maxMileage: number | null;
};

type InventoryAlertProps = {
  activeFilterCount: number;
  criteria: InventoryAlertCriteria;
  placement: 'toolbar' | 'empty';
  resultCount: number;
};

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function InventoryAlert({ activeFilterCount, criteria, placement, resultCount }: InventoryAlertProps) {
  const titleId = useId();
  const successTitleId = useId();
  const emailErrorId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmissionState>('idle');
  const [failure, setFailure] = useState<RequestFailure | null>(null);
  const { closeDialog, dialogRef, openDialog: animateDialogOpen } = useDialogMotion({
    contentKey: state === 'success' ? 'success' : undefined,
    itemSelector: '.price-alert-form > :not(.price-alert-honeypot)',
    panelSelector: '.price-alert-panel',
  });

  const criteriaLabels: string[] = [];
  if (criteria.query) criteriaLabels.push(`“${criteria.query}”`);
  if (criteria.make) criteriaLabels.push(criteria.make);
  if (criteria.transmission) criteriaLabels.push(criteria.transmission === 'automatic' ? 'Automática' : 'Manual');
  if (criteria.bodyType) criteriaLabels.push(criteria.bodyType);
  if (criteria.fuel) criteriaLabels.push(criteria.fuel);
  if (criteria.minPrice !== null) criteriaLabels.push(`Desde ${formatVehiclePrice(criteria.minPrice)}`);
  if (criteria.maxPrice !== null) criteriaLabels.push(`Hasta ${formatVehiclePrice(criteria.maxPrice)}`);
  if (criteria.minMileage !== null) criteriaLabels.push(`Desde ${formatVehicleMileage(criteria.minMileage)}`);
  if (criteria.maxMileage !== null) criteriaLabels.push(`Hasta ${formatVehicleMileage(criteria.maxMileage)}`);

  const openDialog = () => {
    setState('idle');
    setFailure(null);
    captureAnalyticsEvent('inventory_alert_opened', {
      active_filter_count: activeFilterCount,
      result_count: resultCount,
    });
    requestAnimationFrame(animateDialogOpen);
  };

  const triggerCopy = placement === 'empty' ? 'Avisarme si ingresa uno' : 'Crear alerta';

  // The submit button is disabled while sending, which drops focus to <body>. Put it back somewhere useful.
  useEffect(() => {
    if (failure) (failure.field === 'email' ? emailRef : submitRef).current?.focus();
  }, [failure]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');
    const form = new FormData(event.currentTarget);
    const result = await postJson('/api/inventory-alerts', { email, website: form.get('website'), ...criteria });

    if (result.ok) {
      setState('success');
      captureAnalyticsEvent('inventory_alert_created', {
        active_filter_count: activeFilterCount,
        result_count: resultCount,
      });
    } else {
      setState('error');
      setFailure(result.failure);
      captureAnalyticsEvent('inventory_alert_failed', { active_filter_count: activeFilterCount });
    }
  };

  const shownFailure = state === 'error' ? failure : null;
  const emailInvalid = shownFailure?.field === 'email';
  const retry = shownFailure?.retryable === true;

  return (
    <>
      <Button
        className={`inventory-alert-trigger inventory-alert-trigger-${placement}`}
        type="button"
        variant={placement === 'toolbar' ? 'glass' : 'accent'}
        onClick={openDialog}
      >
        <BellRing aria-hidden="true" size={15} strokeWidth={1.9} />
        <span className="inventory-alert-trigger-label">{triggerCopy}</span>
      </Button>

      <dialog
        className="price-alert-dialog inventory-alert-dialog"
        ref={dialogRef}
        aria-labelledby={state === 'success' ? successTitleId : titleId}
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="price-alert-panel glass-panel">
          <button className="price-alert-close" type="button" onClick={closeDialog} aria-label="Cerrar alerta de búsqueda">
            <X aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>

          {state === 'success' ? (
            <div className="price-alert-success" data-dialog-view aria-live="polite">
              <Eyebrow>Revisá tu email</Eyebrow>
              <h2 id={successTitleId}>Confirmá la alerta desde tu correo.</h2>
              <p>Te enviamos un enlace para activarla. Después te escribiremos cuando ingrese una unidad que coincida con estos criterios.</p>
              <div className="status-actions">
                <Button type="button" onClick={closeDialog}>Seguir viendo vehículos <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} /></Button>
              </div>
            </div>
          ) : (
            <form className="price-alert-form ph-no-capture" data-dialog-view data-private onSubmit={handleSubmit}>
              <Eyebrow>Alerta de inventario</Eyebrow>
              <h2 id={titleId}>Avisame cuando aparezca.</h2>
              <p>Guardamos tu búsqueda y te avisamos por email cuando ingrese una unidad compatible.</p>

              <div className="inventory-alert-criteria" aria-label="Criterios de la alerta">
                {criteriaLabels.length > 0
                  ? criteriaLabels.map((label) => <span key={label}>{label}</span>)
                  : <span>Todos los vehículos nuevos</span>}
              </div>

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
              <p className="price-alert-privacy">Usaremos tu email únicamente para avisarte sobre esta búsqueda.</p>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
