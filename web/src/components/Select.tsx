/**
 * Select - docs/07-DESIGN-SYSTEM.md § 4 component table.
 * OWNER: M1.
 */
import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'prefix' | 'id'> {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  options: SelectOption[];
  id?: string;
  readOnly?: boolean;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function preventDefault(event: KeyboardEvent | MouseEvent): void {
  event.preventDefault();
}

export function Select({
  label,
  helper,
  error,
  required,
  prefix,
  suffix,
  options,
  id,
  className,
  disabled,
  readOnly,
  ...rest
}: SelectProps): React.JSX.Element {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helperId = helper ? `${selectId}-helper` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={selectId} className="text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </label>
      <div
        className={cx(
          'relative flex h-10 items-center rounded-md border bg-white px-3 focus-within:border-brand-500',
          error ? 'border-danger-700' : 'border-ink-300',
          disabled && 'border-ink-200 bg-ink-100',
          readOnly && !disabled && 'bg-ink-050',
        )}
      >
        {prefix && <span className="mr-2 shrink-0 text-[15px] text-ink-600">{prefix}</span>}
        <select
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-readonly={readOnly || undefined}
          onKeyDown={readOnly ? preventDefault : undefined}
          onMouseDown={readOnly ? preventDefault : undefined}
          className={cx(
            'w-full min-w-0 appearance-none bg-transparent text-[15px] text-ink-900 disabled:cursor-not-allowed disabled:text-ink-500',
            !suffix && 'pr-6',
          )}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {suffix ? (
          <span className="ml-2 shrink-0 text-[15px] text-ink-600">{suffix}</span>
        ) : (
          <ChevronDown
            className="pointer-events-none absolute right-3 h-4 w-4 text-ink-600"
            strokeWidth={2}
            aria-hidden="true"
          />
        )}
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
