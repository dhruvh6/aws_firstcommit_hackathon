/**
 * QuantityStepper - the partial-reservation control (docs/07-DESIGN-SYSTEM.md
 * § 4 component table; anatomy per docs/06 § 6 S3 and § 9 S6 reserve box).
 * OWNER: M1.
 *
 * Typing is allowed and validated on blur. Exceeding `max` never silently
 * clamps: the typed value is kept, the helper turns into
 * "Only N <unit> available", and the caller is expected to disable its
 * primary action from the same `value` it already holds (docs/06 § 6).
 */
import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { label } from '@dse/shared';

export interface QuantityStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  id?: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function QuantityStepper({
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled = false,
  id,
}: QuantityStepperProps): React.JSX.Element {
  const unitLabel = label('unit', unit) ?? unit;
  const [text, setText] = useState(String(value));

  // Reflect an externally-driven value change (e.g. the card resetting its
  // default) without clobbering what the person is mid-typing.
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const overMax = value > max;
  const helperId = `${id ?? 'qty'}-helper`;

  function commit(next: number): void {
    setText(String(next));
    onChange(next);
  }

  function step_(delta: number): void {
    if (disabled) return;
    const next = round2(Math.min(max, Math.max(min, value + delta)));
    commit(next);
  }

  function handleBlur(): void {
    const parsed = Number(text);
    if (text.trim() === '' || Number.isNaN(parsed)) {
      commit(min);
      return;
    }
    const clampedLow = Math.max(min, round2(parsed));
    // Never clamp downward from an over-max value - only the floor is enforced here.
    setText(String(clampedLow));
    onChange(clampedLow);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      step_(step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      step_(-step);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease quantity by ${step} ${unitLabel}`}
          onClick={() => step_(-step)}
          disabled={disabled || value <= min}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-300 text-ink-700 hover:bg-ink-050 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-500"
        >
          <Minus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          disabled={disabled}
          aria-describedby={helperId}
          aria-invalid={overMax || undefined}
          onChange={(event) => setText(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="h-9 w-16 rounded-md border border-ink-300 bg-white text-center text-[15px] font-semibold text-ink-900 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500"
        />
        <button
          type="button"
          aria-label={`Increase quantity by ${step} ${unitLabel}`}
          onClick={() => step_(step)}
          disabled={disabled || value >= max}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-300 text-ink-700 hover:bg-ink-050 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-500"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
        <span className="text-[15px] text-ink-600">{unitLabel}</span>
      </div>
      <p id={helperId} className={overMax ? 'text-[13px] text-danger-700' : 'text-[13px] text-ink-600'}>
        {overMax ? `Only ${max} ${unitLabel} available` : `Max ${max} ${unitLabel}`}
      </p>
    </div>
  );
}
