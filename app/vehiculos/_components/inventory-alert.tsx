'use client';

import { FormEvent, useId, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BellRing, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { formatVehicleMileage, formatVehiclePrice } from '@/features/vehicles/presentation/formatters';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const successTitleId = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmissionState>('idle');
  const [message, setMessage] = useState('');

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
    setMessage('');
    captureAnalyticsEvent('inventory_alert_opened', {
      active_filter_count: activeFilterCount,
      result_count: resultCount,
    });
    dialogRef.current?.showModal();
  };

  const closeDialog = () => dialogRef.current?.close();

  const triggerCopy = placement === 'empty' ? 'Avisarme si ingresa uno' : 'Crear alerta';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');
    setMessage('');
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch('/api/inventory-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website: form.get('website'), ...criteria }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || 'No pudimos guardar la alerta.');

      setState('success');
      captureAnalyticsEvent('inventory_alert_created', {
        active_filter_count: activeFilterCount,
        result_count: resultCount,
      });
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar la alerta.');
      captureAnalyticsEvent('inventory_alert_failed', { active_filter_count: activeFilterCount });
    }
  };

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
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
      >
        <div className="price-alert-panel glass-panel">
          <button className="price-alert-close" type="button" onClick={closeDialog} aria-label="Cerrar alerta de búsqueda">
            <X aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>

          {state === 'success' ? (
            <div className="price-alert-success" aria-live="polite">
              <span aria-hidden="true"><Check size={22} strokeWidth={2.2} /></span>
              <p>Alerta activada</p>
              <h2 id={successTitleId}>La búsqueda queda en nuestras manos.</h2>
              <p>Te escribiremos cuando ingrese una unidad que coincida con estos criterios.</p>
              <Button type="button" onClick={closeDialog}>Seguir viendo vehículos <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} /></Button>
            </div>
          ) : (
            <form className="price-alert-form ph-no-capture" data-private onSubmit={handleSubmit}>
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
              <p className="price-alert-privacy">Usaremos tu email únicamente para avisarte sobre esta búsqueda.</p>
              {state === 'error' && <p className="price-alert-error" role="alert">{message}</p>}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
