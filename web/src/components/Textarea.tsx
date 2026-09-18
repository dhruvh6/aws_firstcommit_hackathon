/**
 * Textarea - docs/07-DESIGN-SYSTEM.md § 4 component table, grouped with
 * Input/Select/DatePicker. OWNER: M1.
 */
import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  id?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Textarea({
  label,
  helper,
  error,
  required,
  id,
  className,
  disabled,
  maxLength,
  value,
  ...rest
}: TextareaProps): React.JSX.Element {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const helperId = helper ? `${textareaId}-helper` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const counterId = maxLength !== undefined ? `${textareaId}-counter` : undefined;
  const describedBy = [errorId, helperId, counterId].filter(Boolean).join(' ') || undefined;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={textareaId} className="text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </label>
      <textarea
        id={textareaId}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'min-h-24 w-full rounded-md border bg-white px-3 py-2 text-[15px] text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:border-ink-200 disabled:bg-ink-100 disabled:text-ink-500',
          error ? 'border-danger-700' : 'border-ink-300',
        )}
        {...rest}
      />
      <div className="flex items-start justify-between gap-2">
        {error ? (
          <p id={errorId} className="text-[13px] text-danger-700">
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="text-[13px] text-ink-600">
            {helper}
          </p>
        ) : (
          <span />
        )}
        {maxLength !== undefined && (
          <span id={counterId} className="shrink-0 text-[13px] text-ink-600">
            {length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
