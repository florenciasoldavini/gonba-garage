'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { ValuationContactFields } from './valuation-contact-fields';
import { ValuationStepper } from './valuation-stepper';
import { ValuationSuccess } from './valuation-success';
import { VehicleCatalogFields } from './vehicle-catalog-fields';
import { VehicleConditionFields } from './vehicle-condition-fields';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

const TOTAL_STEPS = 3;

export function ValuationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [isStepComplete, setIsStepComplete] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const hasStartedRef = useRef(false);

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

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const activeStep = formRef.current?.querySelector<HTMLElement>('[data-step]:not([hidden])');
      if (!activeStep) return;

      gsap.fromTo(
        activeStep,
        { x: step === 1 ? 0 : 28, autoAlpha: 0 },
        { x: 0, autoAlpha: 1, duration: 0.48, ease: 'power3.out' },
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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    captureAnalyticsEvent('valuation_demo_completed', { total_steps: TOTAL_STEPS });
    setSubmitted(true);
    event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (submitted) {
    return <ValuationSuccess onReset={() => { setSubmitted(false); setStep(1); }} />;
  }

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
          <span>Formulario de tasación · Paso {step} de {TOTAL_STEPS}</span>
          <strong>Completalo en aproximadamente 3 minutos.</strong>
        </div>
        <span className="valuation-form-time">3 min</span>
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
            <Button type="submit" disabled={!isStepComplete}>Solicitar estimación <ArrowUpRight aria-hidden="true" size={16} /></Button>
          )}
        </div>
        <small>Esta versión es demostrativa y no envía información todavía.</small>
      </div>
    </form>
  );
}
