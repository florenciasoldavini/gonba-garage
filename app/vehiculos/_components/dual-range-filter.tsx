'use client';

import type { ReactNode } from 'react';
import './dual-range-filter.css';

type DualRangeFilterProps = {
  formatValue: (value: number) => string;
  label: string;
  /** Rendered beside the label, e.g. an info disclosure. */
  labelAddon?: ReactNode;
  maximum: number;
  maximumAriaLabel: string;
  maximumValue: number;
  minimum: number;
  minimumAriaLabel: string;
  minimumValue: number;
  onMaximumChange: (value: number) => void;
  onMinimumChange: (value: number) => void;
  step: number;
};

export function DualRangeFilter({
  formatValue,
  label,
  labelAddon,
  maximum,
  maximumAriaLabel,
  maximumValue,
  minimum,
  minimumAriaLabel,
  minimumValue,
  onMaximumChange,
  onMinimumChange,
  step,
}: DualRangeFilterProps) {
  const span = maximum - minimum;
  const minimumPosition = ((minimumValue - minimum) / span) * 100;
  const maximumPosition = ((maximumValue - minimum) / span) * 100;

  return (
    <div className="catalog-field catalog-range-filter">
      <div className="catalog-range-heading">
        {labelAddon ? <div className="catalog-range-label"><span>{label}</span>{labelAddon}</div> : <span>{label}</span>}
        <output>{formatValue(minimumValue)} — {formatValue(maximumValue)}</output>
      </div>
      <div className="catalog-range-control">
        <div className="catalog-range-track" aria-hidden="true">
          <span style={{ left: `${minimumPosition}%`, right: `${100 - maximumPosition}%` }} />
        </div>
        <input
          aria-label={minimumAriaLabel}
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={minimumValue}
          onChange={(event) => onMinimumChange(Math.min(Number(event.target.value), maximumValue - step))}
        />
        <input
          aria-label={maximumAriaLabel}
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={maximumValue}
          onChange={(event) => onMaximumChange(Math.max(Number(event.target.value), minimumValue + step))}
        />
      </div>
      <div className="catalog-range-limits" aria-hidden="true">
        <span>{formatValue(minimum)}</span>
        <span>{formatValue(maximum)}</span>
      </div>
    </div>
  );
}
