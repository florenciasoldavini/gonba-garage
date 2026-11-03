'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { ValuationContactFields } from './valuation-contact-fields';
import { getValuationDetails, getValuationWhatsAppUrl, type ValuationDetail } from './valuation-message';
import { ValuationStepper } from './valuation-stepper';
import { ValuationSuccess } from './valuation-success';
import { VehicleCatalogFields } from './vehicle-catalog-fields';
import { VehicleConditionFields } from './vehicle-condition-fields';
import './valuation-form.css';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

const TOTAL_STEPS = 3;

export function ValuationForm() {
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [isStepComplete, setIsStepComplete] = useState(false);
  const [details, setDetails] = useState<ValuationDetail[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const hasStartedRef = useRef(false);
  const previousStepRef = useRef(step);

  const updateStepCompleteness = useCallback(() => {
    const currentSection = formRef.current?.querySelector<HTMLElement>('[data-step]:not([hidden])');
    if (!currentSection) return;

    const requiredControls = currentSection.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('[required]');
    const requiredCustomSelects = currentSection.querySelectorAll<HTMLButtonElement>('[data-required-select="true"]');
    const nativeFieldsAreComplete = Array.from(requiredControls).every(control => control.checkValidity());
    const customSelectsAreComplete = Array.from(requiredCustomSelects).every(control => Boolean(control.dataset.value));

    setIsStepComplete(nativeFieldsAreComplete && customSelectsAreComplete);
  }, []);

  const updateDetails = useCallback(() => {
    if (formRef.current) setDetails(getValuationDetails(new FormData(formRef.current)));
  }, []);

  useEffect(() => {
    updateStepCompleteness();
  }, [updateStepCompleteness]);

  // Move focus to the new step's heading, but not on first load.
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    formRef.current
      ?.querySelector<HTMLElement>(`[data-step="${step}"] [role="heading"]`)
      ?.focus({ preventScroll: true });
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
    requestAnimationFrame(() => {
      updateStepCompleteness();
      updateDetails();
    });
  };

  const moveToStep = (nextStep: number) => {
    setIsStepComplete(false);
    setStep(nextStep);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    formRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const validateCurrentStep = () => {
    const currentSection = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const missingCustomSelect = currentSection?.querySelector<HTMLButtonElement>(
      '[data-required-select="true"][data-value=""]',
    );
    if (missingCustomSelect) {
      missingCustomSelect.setAttribute('aria-invalid', 'true');
      missingCustomSelect.focus();
      return false;
    }

    const controls = currentSection?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea',
    );
    for (const control of controls ?? []) {
      if (!control.checkValidity()) {
        control.reportValidity();
        return false;
      }
    }

    return true;
  };

  const continueToNextStep = () => {
    if (!validateCurrentStep()) return;

    captureAnalyticsEvent('valuation_step_completed', { step });
    moveToStep(Math.min(step + 1, TOTAL_STEPS));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < TOTAL_STEPS) {
      continueToNextStep();
      return;
    }

    if (!validateCurrentStep()) return;

    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();

    // Catalog picks arrive in hidden inputs; a hand-typed make or model is free text and stays out.
    const form = event.currentTarget;
    const catalogValue = (name: string) => {
      const control = form.elements.namedItem(name);
      return control instanceof HTMLInputElement && control.type === 'hidden' ? value(name) : '';
    };
    captureAnalyticsEvent('valuation_sent_to_whatsapp', {
      make: catalogValue('make'),
      model: catalogValue('model'),
      total_steps: TOTAL_STEPS,
      year: Number(value('year')),
    });
    const nextWhatsAppUrl = getValuationWhatsAppUrl(data);
    window.open(nextWhatsAppUrl, '_blank', 'noopener,noreferrer');
    setWhatsAppUrl(nextWhatsAppUrl);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  if (whatsAppUrl) {
    return (
      <ValuationSuccess
        whatsAppUrl={whatsAppUrl}
        onReset={() => {
          setWhatsAppUrl(null);
          setStep(1);
        }}
      />
    );
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
          <span>Formulario de tasación · 1 min</span>
          <strong>Te pedimos el auto, su estado y tu nombre.</strong>
        </div>
      </div>

      <ValuationStepper currentStep={step} />
      <VehicleCatalogFields hidden={step !== 1} />
      <VehicleConditionFields hidden={step !== 2} />
      <ValuationContactFields hidden={step !== 3} details={details} />

      <div className="valuation-form-submit">
        <div className="valuation-step-actions">
          {step > 1 ? (
            <button className="valuation-back-button" type="button" onClick={() => moveToStep(step - 1)}>
              <ArrowLeft aria-hidden="true" size={15} /> Volver
            </button>
          ) : null}
          {step < TOTAL_STEPS ? (
            <Button type="button" disabled={!isStepComplete} onClick={continueToNextStep}>
              Continuar <ArrowRight aria-hidden="true" size={16} />
            </Button>
          ) : (
            <Button type="submit" disabled={!isStepComplete} aria-describedby="valuation-handoff-note">
              Enviar por WhatsApp <ArrowUpRight aria-hidden="true" size={16} />
            </Button>
          )}
        </div>
        {step === TOTAL_STEPS && (
          <p className="valuation-handoff-note" id="valuation-handoff-note">
            <strong>Se abre tu WhatsApp con el mensaje listo.</strong> Lo revisás y lo mandás vos · Sin compromiso.
          </p>
        )}
      </div>
    </form>
  );
}
