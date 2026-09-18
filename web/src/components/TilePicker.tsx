/**
 * TilePicker - docs/07-DESIGN-SYSTEM.md § 4 component table: 4 category
 * tiles, icon + label, radiogroup semantics, roving tabindex + arrow keys.
 * Selected = brand-600 border + brand-050 fill. OWNER: M1.
 */
import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { categoryIcon } from '../lib/categoryIcon.js';
import { useRovingTabIndex } from '../lib/useRovingTabIndex.js';

export interface TilePickerOption {
  value: string;
  label: string;
  /** Icon slug from meta, resolved via lib/categoryIcon.ts. */
  icon: string;
}

export interface TilePickerProps {
  label: string;
  options: TilePickerOption[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  id?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function TilePicker({
  label,
  options,
  value,
  onChange,
  error,
  required,
  id,
}: TilePickerProps): React.JSX.Element {
  const generatedId = useId();
  const groupId = id ?? generatedId;
  const errorId = error ? `${groupId}-error` : undefined;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const roving = useRovingTabIndex(selectedIndex >= 0 ? selectedIndex : 0);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const before = roving.focusedIndex;
    roving.onKeyDown(event, options.length);
    if (roving.focusedIndex !== before) {
      // Arrow keys move focus; a radiogroup also moves selection with them.
      const next = options[roving.focusedIndex] ?? options[before];
      if (next) onChange(next.value);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${groupId}-label`} className="text-[13px] font-semibold text-ink-700">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </span>
      <div
        id={groupId}
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {options.map((option, index) => {
          const Icon = categoryIcon(option.icon);
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={roving.itemRef(index)}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={roving.focusedIndex === index ? 0 : -1}
              onClick={() => {
                roving.setFocusedIndex(index);
                onChange(option.value);
              }}
              className={cx(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 bg-white px-3 py-4 text-center transition-colors',
                selected ? 'border-brand-600 bg-brand-050' : 'border-ink-300 hover:bg-ink-050',
              )}
            >
              <Icon className="h-6 w-6 text-ink-700" strokeWidth={2} aria-hidden="true" />
              <span className="text-[15px] font-medium text-ink-900">{option.label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="text-[13px] text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}
