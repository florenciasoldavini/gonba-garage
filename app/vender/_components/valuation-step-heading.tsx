import type { LucideIcon } from 'lucide-react';
import './valuation-step-heading.css';

type ValuationStepHeadingProps = {
  description: string;
  icon: LucideIcon;
  step: number;
  title: string;
};

export function ValuationStepHeading({ description, icon: Icon, step, title }: ValuationStepHeadingProps) {
  return (
    <div className="valuation-step-heading">
      <span><Icon aria-hidden="true" size={17} /></span>
      <div><strong aria-level={2} role="heading" tabIndex={-1}>0{step} · {title}</strong><p>{description}</p></div>
    </div>
  );
}
