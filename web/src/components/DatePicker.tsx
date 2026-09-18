/**
 * DatePicker - docs/07-DESIGN-SYSTEM.md § 4 component table. A thin styled
 * wrapper over the native `<input type="date">`: this screen favours speed
 * over polish (docs/06 § 7), and the design system gives no calendar-popup
 * visual spec to build against. OWNER: M1.
 */
import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'prefix'> {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  id?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function DatePicker({
  label,
  helper,
  error,
  required,
  id,
  className,
  disabled,
  ...rest
}: DatePickerProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helper ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </label>
      <div
        className={cx(
          'flex h-10 items-center rounded-md border bg-white px-3 focus-within:border-brand-500',
          error ? 'border-danger-700' : 'border-ink-300',
          disabled && 'border-ink-200 bg-ink-100',
        )}
      >
        <input
          id={inputId}
          type="date"
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-full min-w-0 bg-transparent text-[15px] text-ink-900 disabled:cursor-not-allowed disabled:text-ink-500"
          {...rest}
        />
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
