/**
 * RadioGroup - a form primitive docs/07-DESIGN-SYSTEM.md § 4 implies
 * alongside Input/Select/DatePicker/Textarea (S4 condition, treated,
 * handoff mode; S5 will reuse it for acceptable-condition-style choices).
 * OWNER: M1.
 *
 * Native <input type="radio"> elements sharing one `name` already give
 * roving tabindex and arrow-key navigation for free - no custom keyboard
 * handling needed here, unlike TilePicker's custom button tiles.
 */
import { useId } from 'react';

export interface RadioGroupOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  label: string;
  name: string;
  options: RadioGroupOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  helper?: string;
  required?: boolean;
  id?: string;
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  error,
  helper,
  required,
  id,
}: RadioGroupProps): React.JSX.Element {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const labelId = `${groupId}-label`;
  const helperId = helper ? `${groupId}-helper` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        {options.map((option, index) => (
          <label key={option.value} className="inline-flex items-center gap-2 text-[15px] text-ink-900">
            <input
              type="radio"
              id={index === 0 ? groupId : undefined}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              required={required}
              className="h-4 w-4 accent-brand-600"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] text-danger-700">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-[13px] text-ink-600">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
