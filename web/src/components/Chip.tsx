/**
 * Chip - docs/07-DESIGN-SYSTEM.md § 4 component table.
 * OWNER: M1.
 */
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChipVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

export interface ChipProps {
  variant?: ChipVariant;
  icon?: LucideIcon;
  removable?: boolean;
  onRemove?: () => void;
  children: ReactNode;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  ok: 'bg-ok-050 text-ok-700',
  warn: 'bg-warn-050 text-warn-700',
  danger: 'bg-danger-050 text-danger-700',
  info: 'bg-brand-050 text-info-700',
};

export function Chip({
  variant = 'neutral',
  icon: Icon,
  removable = false,
  onRemove,
  children,
}: ChipProps): React.JSX.Element {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[13px] font-medium leading-[18px] transition-[filter]',
        VARIANT_CLASSES[variant],
        removable && 'hover:brightness-95',
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />}
      <span>{children}</span>
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={typeof children === 'string' ? `Remove ${children}` : 'Remove'}
          className="ml-0.5 inline-flex shrink-0 rounded-full p-0.5 hover:bg-ink-200"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
