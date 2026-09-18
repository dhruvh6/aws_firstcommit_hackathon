/**
 * Dialog - docs/07-DESIGN-SYSTEM.md § 4 component table: title, body,
 * confirm/cancel, focus-trapped, Esc closes, focus returns to trigger.
 * OWNER: M1. First consumer: S9's "Confirm handoff" (irreversible -
 * docs/02 § 9 "the demo will double-click it"); S8's dashboard reuses it
 * for the same confirmation (docs/06 § 11).
 */
import { useEffect, useId, useRef } from 'react';
import { Button } from './Button.js';
import type { ButtonVariant } from './Button.js';

export interface DialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function Dialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: DialogProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();
  const bodyId = useId();

  // Focus the first control (Cancel, by markup order - never default focus onto
  // the destructive/primary action), trap Tab within the dialog, close on Esc,
  // and return focus to whatever opened it once it closes.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const focusable = containerRef.current ? getFocusable(containerRef.current) : [];
    focusable[0]?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;
      const items = getFocusable(containerRef.current);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4"
      onClick={onCancel}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(event) => event.stopPropagation()}
        className="motion-safe:animate-[dialog-in_160ms_ease-out_backwards] motion-reduce:animate-none w-full max-w-sm rounded-lg bg-white p-6 shadow-hover"
      >
        <h2 id={titleId} className="text-base font-semibold text-ink-900">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-[15px] text-ink-700">
          {body}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
