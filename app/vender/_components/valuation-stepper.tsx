import { Check } from 'lucide-react';

const steps = ['Vehículo', 'Estado', 'Contacto'];

export function ValuationStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="valuation-stepper" aria-label={`Paso ${currentStep} de ${steps.length}`}>
      <div className="valuation-stepper-track" aria-hidden="true">
        <span style={{ width: `${(currentStep / steps.length) * 100}%` }} />
      </div>
      <ol>
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          return (
            <li
              className={stepNumber === currentStep ? 'is-active' : stepNumber < currentStep ? 'is-complete' : ''}
              aria-current={stepNumber === currentStep ? 'step' : undefined}
              key={label}
            >
              <span>{stepNumber < currentStep ? <Check aria-hidden="true" size={12} /> : `0${stepNumber}`}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
