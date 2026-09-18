/**
 * EmptyState - docs/07-DESIGN-SYSTEM.md § 4 component table.
 * OWNER: M1.
 */
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button.js';
import type { ButtonVariant } from './Button.js';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  actions?: [EmptyStateAction] | [EmptyStateAction, EmptyStateAction];
}

export function EmptyState({ icon: Icon, title, body, actions }: EmptyStateProps): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-lg border border-ink-200 bg-white px-6 py-12 text-center shadow-card"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-100">
        <Icon className="h-6 w-6 text-ink-600" strokeWidth={2} aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="max-w-sm text-[15px] text-ink-600">{body}</p>
      {actions && actions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant ?? 'secondary'} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
