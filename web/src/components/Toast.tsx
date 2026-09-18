/**
 * Toast - docs/07-DESIGN-SYSTEM.md § 4 component table + § 6 Motion.
 * OWNER: M1.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dismissToast, getToastSnapshot, subscribeToasts } from '../state/toast.js';
import type { ToastItem, ToastVariant } from '../state/toast.js';

const AUTO_DISMISS_MS = 4000;

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const ICONS: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-ok-700 text-ok-700',
  error: 'border-danger-700 text-danger-700',
  info: 'border-info-700 text-info-700',
};

function ToastRow({ item }: { item: ToastItem }): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id]);

  const Icon = ICONS[item.variant];

  return (
    <div
      role={item.variant === 'error' ? 'alert' : 'status'}
      aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
      className={cx(
        'flex w-full max-w-sm items-start gap-2 rounded-lg border bg-white px-4 py-3 shadow-hover',
        'motion-safe:animate-[toast-in_160ms_ease-out] motion-reduce:animate-[toast-in-reduced_160ms_ease-out]',
        VARIANT_CLASSES[item.variant],
      )}
    >
      <Icon className="h-4 w-4 shrink-0 translate-y-0.5" strokeWidth={2} aria-hidden="true" />
      <p className="flex-1 text-[14px] text-ink-900">{item.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-0.5 text-ink-600 hover:bg-ink-100"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toast(): React.JSX.Element {
  const items = useSyncExternalStore(subscribeToasts, getToastSnapshot, getToastSnapshot);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full max-w-sm">
          <ToastRow item={item} />
        </div>
      ))}
    </div>
  );
}
