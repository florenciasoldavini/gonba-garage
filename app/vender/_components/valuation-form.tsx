'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ValuationContactFields } from './valuation-contact-fields';
import { ValuationStepper } from './valuation-stepper';
import { ValuationSuccess } from './valuation-success';
import { VehicleCatalogFields } from './vehicle-catalog-fields';
import { VehicleConditionFields } from './vehicle-condition-fields';

const TOTAL_STEPS = 3;

export function ValuationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);

  const moveToStep = (nextStep: number) => {
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

    moveToStep(Math.min(step + 1, TOTAL_STEPS));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (submitted) {
    return <ValuationSuccess onReset={() => { setSubmitted(false); setStep(1); }} />;
  }

  return (
    <form className="valuation-form glass-panel" ref={formRef} onSubmit={handleSubmit}>
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
            <Button type="button" onClick={continueToNextStep}>
              Continuar <ArrowUpRight aria-hidden="true" size={16} />
            </Button>
          ) : (
            <Button type="submit">Solicitar estimación <ArrowUpRight aria-hidden="true" size={16} /></Button>
          )}
        </div>
        <small>Esta versión es demostrativa y no envía información todavía.</small>
      </div>
    </form>
  );
}
