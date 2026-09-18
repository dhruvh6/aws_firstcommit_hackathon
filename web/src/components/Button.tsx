/**
 * Button - docs/07-DESIGN-SYSTEM.md § 4 component table + Button anatomy block.
 * OWNER: M1.
 */
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3',
  md: 'h-10 px-5',
  lg: 'h-11 px-6',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-500 text-ink-900 hover:bg-accent-600 disabled:bg-ink-200 disabled:text-ink-500',
  secondary:
    'border border-brand-600 bg-white text-brand-600 hover:bg-brand-050 disabled:border-ink-300 disabled:bg-white disabled:text-ink-500',
  ghost:
    'bg-transparent text-brand-600 hover:underline disabled:text-ink-500',
  danger:
    'border border-danger-700 bg-white text-danger-700 hover:bg-danger-050 disabled:border-ink-300 disabled:bg-white disabled:text-ink-500',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      aria-busy={loading || undefined}
      disabled={isDisabled}
      className={cx(
        'relative inline-flex items-center justify-center gap-2 rounded-md text-[15px] font-semibold leading-5 transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      <span className={cx('inline-flex items-center gap-2', loading && 'opacity-0')}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}
