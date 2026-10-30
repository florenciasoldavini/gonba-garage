import type { LucideIcon } from 'lucide-react';

type StatusTone = 'success' | 'danger';

/**
 * Marks the outcome of something the person just did. Decorative: the eyebrow and title carry the
 * meaning. A rounded tile rather than a circle, because circles are reserved for icon buttons.
 */
export function StatusIcon({ icon: Icon, tone = 'success' }: { icon: LucideIcon; tone?: StatusTone }) {
  return (
    <span className={`status-icon status-icon-${tone}`} aria-hidden="true">
      <Icon size={22} strokeWidth={2} />
    </span>
  );
}

export function StatusSteps({ steps, title = '¿Qué sigue?' }: { steps: string[]; title?: string }) {
  return (
    <div className="status-steps">
      <strong>{title}</strong>
      <ol>
        {steps.map((step, index) => (
          <li key={step}><span>{String(index + 1).padStart(2, '0')}</span> {step}</li>
        ))}
      </ol>
    </div>
  );
}
