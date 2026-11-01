'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { getWhatsAppUrl } from '@/lib/contact';
import { ValuationContactFields } from './valuation-contact-fields';
import { ValuationStepper } from './valuation-stepper';
import { VehicleCatalogFields } from './vehicle-catalog-fields';
import { VehicleConditionFields } from './vehicle-condition-fields';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

const TOTAL_STEPS = 3;

export function ValuationForm() {
  const [step, setStep] = useState(1);
  const [isStepComplete, setIsStepComplete] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hasStartedRef = useRef(false);
  const previousStepRef = useRef(step);

  const updateStepCompleteness = useCallback(() => {
    const currentSection = formRef.current?.querySelector<HTMLElement>('[data-step]:not([hidden])');
    if (!currentSection) return;

    const requiredControls = currentSection.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[required]');
    const requiredCustomSelects = currentSection.querySelectorAll<HTMLButtonElement>('[data-required-select="true"]');
    const nativeFieldsAreComplete = Array.from(requiredControls).every((control) => control.checkValidity());
    const customSelectsAreComplete = Array.from(requiredCustomSelects).every((control) => Boolean(control.dataset.value));
    const consentControl = formRef.current?.elements.namedItem('consent');
    const consentIsComplete = currentSection.dataset.step !== String(TOTAL_STEPS)
      || consentControl instanceof HTMLInputElement && consentControl.checked;

    setIsStepComplete(nativeFieldsAreComplete && customSelectsAreComplete && consentIsComplete);
  }, []);

  useEffect(() => {
    updateStepCompleteness();
  }, [updateStepCompleteness]);

  // Move focus to the new step's heading, but not on first load.
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"] [role="heading"]`)?.focus({ preventScroll: true });
  }, [step]);

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const activeStep = formRef.current?.querySelector<HTMLElement>('[data-step]:not([hidden])');
      if (!activeStep) return;

      gsap.fromTo(
        activeStep,
        { x: step === 1 ? 0 : 28, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.48, ease: 'power3.out' },
      );
      gsap.fromTo(
        '.valuation-stepper li.is-active > span',
        { scale: 0.72 },
        { scale: 1, duration: 0.42, ease: 'back.out(1.8)' },
      );
    },
    { scope: formRef, dependencies: [step], revertOnUpdate: true },
  );

  const scheduleCompletenessUpdate = () => {
    requestAnimationFrame(updateStepCompleteness);
  };

  const moveToStep = (nextStep: number) => {
    setIsStepComplete(false);
    setStep(nextStep);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    formRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const continueToNextStep = () => {
    const currentSection = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const missingCustomSelect = currentSection?.querySelector<HTMLButtonElement>('[data-required-select="true"][data-value=""]');
    if (missingCustomSelect) {
      missingCustomSelect.setAttribute('aria-invalid', 'true');
      missingCustomSelect.focus();
      return;
    }

    const controls = currentSection?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
    for (const control of controls ?? []) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return;
      }
    }

    captureAnalyticsEvent('valuation_step_completed', { step });
    moveToStep(Math.min(step + 1, TOTAL_STEPS));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < TOTAL_STEPS) {
      continueToNextStep();
      return;
    }

    const contactSection = event.currentTarget.querySelector<HTMLElement>('[data-step="3"]');
    const contactControls = contactSection?.querySelectorAll<HTMLInputElement>('input') ?? [];
    const consentControl = event.currentTarget.elements.namedItem('consent');
    const controls = [
      ...contactControls,
      ...(consentControl instanceof HTMLInputElement ? [consentControl] : []),
    ];

    for (const control of controls) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return;
      }
    }

    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    const mileage = Number(value('mileage')).toLocaleString('es-AR');
    const optionalLine = (label: string, name: string) => value(name) ? `${label}: ${value(name)}` : null;
    const message = [
      `Hola, Gonba's Garage. Soy ${value('name')} y me gustaría que evalúen mi auto para venderlo.`,
      '',
      `Marca: ${value('make')}`,
      `Modelo: ${value('model')}`,
      `Año: ${value('year')}`,
      optionalLine('Versión', 'version'),
      optionalLine('Color', 'color'),
      `Kilometraje: ${mileage} km`,
      `Estado general: ${value('condition')}`,
      optionalLine('Comentarios', 'notes'),
      '',
      `Teléfono de contacto: ${value('phone')}`,
    ].filter((line) => line !== null).join('\n');

    // Catalog picks arrive in hidden inputs; a hand-typed make or model is free text and stays out.
    const form = event.currentTarget;
    const catalogValue = (name: string) => {
      const control = form.elements.namedItem(name);
      return control instanceof HTMLInputElement && control.type === 'hidden' ? value(name) : '';
    };
    captureAnalyticsEvent('valuation_sent_to_whatsapp', {
      has_photos: data.getAll('photos').some((photo) => photo instanceof File && photo.size > 0),
      make: catalogValue('make'),
      model: catalogValue('model'),
      total_steps: TOTAL_STEPS,
      year: Number(value('year')),
    });
    window.open(getWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  return (
    <form
      className="valuation-form glass-panel ph-no-capture"
      data-private
      ref={formRef}
      noValidate
      onChange={scheduleCompletenessUpdate}
      onClick={scheduleCompletenessUpdate}
      onInput={scheduleCompletenessUpdate}
      onFocusCapture={() => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;
        captureAnalyticsEvent('valuation_started', {});
      }}
      onSubmit={handleSubmit}
    >
      <div className="valuation-form-heading">
        <div>
          <span>Formulario de tasación · 3 min</span>
          <strong>Te pedimos el auto, su estado y cómo contactarte.</strong>
        </div>
      </div>

      <ValuationStepper currentStep={step} />
      <VehicleCatalogFields hidden={step !== 1} />
      <VehicleConditionFields hidden={step !== 2} />
      <ValuationContactFields hidden={step !== 3} />

      <div className="valuation-form-submit">
        {step === TOTAL_STEPS ? (
          <label className="valuation-consent">
            <input required type="checkbox" name="consent" />
            <span><Check aria-hidden="true" size={11} /></span>
            Acepto que me contacten para evaluar este vehículo.
          </label>
        ) : null}
        <div className="valuation-step-actions">
          {step > 1 ? (
            <button className="valuation-back-button" type="button" onClick={() => moveToStep(step - 1)}>
              <ArrowLeft aria-hidden="true" size={15} /> Volver
            </button>
          ) : null}
          {step < TOTAL_STEPS ? (
            <Button type="button" disabled={!isStepComplete} onClick={continueToNextStep}>
              Continuar <ArrowUpRight aria-hidden="true" size={16} />
            </Button>
          ) : (
            <Button type="submit" disabled={!isStepComplete}>Enviar mensaje <ArrowUpRight aria-hidden="true" size={16} /></Button>
          )}
        </div>
        <small>Se abrirá WhatsApp con los datos del auto, sin fotos. Revisá el mensaje y envialo cuando quieras.</small>
      </div>
    </form>
  );
}
