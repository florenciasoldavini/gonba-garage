import type { LucideIcon } from 'lucide-react';

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
      <div><strong>0{step} · {title}</strong><p>{description}</p></div>
    </div>
  );
}
