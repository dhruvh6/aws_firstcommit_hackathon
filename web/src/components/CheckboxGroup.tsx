/**
 * CheckboxGroup - a form primitive alongside RadioGroup
 * (docs/07-DESIGN-SYSTEM.md § 4 groups Input/Select/DatePicker/Textarea with
 * RadioGroup; this fills the same role for a multi-select choice, used by
 * S5's "Acceptable condition"). OWNER: M1.
 *
 * Native <input type="checkbox"> elements already give correct tab order
 * and space-to-toggle for free - no custom keyboard handling needed here,
 * same reasoning as RadioGroup.
 */
import { useId } from 'react';

export interface CheckboxGroupOption {
  value: string;
  label: string;
}

export interface CheckboxGroupProps {
  label: string;
  name: string;
  options: CheckboxGroupOption[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  helper?: string;
  required?: boolean;
  id?: string;
}

export function CheckboxGroup({
  label,
  name,
  options,
  value,
  onChange,
  error,
  helper,
  required,
  id,
}: CheckboxGroupProps): React.JSX.Element {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const labelId = `${groupId}-label`;
  const helperId = helper ? `${groupId}-helper` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  function toggle(optionValue: string): void {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </span>
      <div
        id={groupId}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        {options.map((option) => (
          <label key={option.value} className="inline-flex items-center gap-2 text-[15px] text-ink-900">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="h-4 w-4 rounded accent-brand-600"
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
