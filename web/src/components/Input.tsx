/**
 * Input - docs/07-DESIGN-SYSTEM.md § 4 component table.
 * OWNER: M1.
 */
import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, WheelEvent } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'id'> {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  id?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Input({
  label,
  helper,
  error,
  required,
  prefix,
  suffix,
  id,
  className,
  disabled,
  readOnly,
  type,
  onWheel,
  ...rest
}: InputProps): React.JSX.Element {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helper ? `${inputId}-helper` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  // Scrolling the page while the cursor happens to sit over a number input
  // silently changes its value in Chrome/Firefox unless the field is
  // blurred first - there is no CSS/attribute to disable this natively.
  function handleWheel(event: WheelEvent<HTMLInputElement>): void {
    if (type === 'number') event.currentTarget.blur();
    onWheel?.(event);
  }

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
          readOnly && !disabled && 'bg-ink-050',
        )}
      >
        {prefix && <span className="mr-2 shrink-0 text-[15px] text-ink-600">{prefix}</span>}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onWheel={handleWheel}
          className="w-full min-w-0 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-500 disabled:cursor-not-allowed disabled:text-ink-500"
          {...rest}
        />
        {suffix && <span className="ml-2 shrink-0 text-[15px] text-ink-600">{suffix}</span>}
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
