/**
 * ErrorState - docs/07-DESIGN-SYSTEM.md § 4 component table +
 * docs/06-UI-SPEC.md § 3 "Error" global behaviour.
 * OWNER: M1.
 */
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button.js';

export interface ErrorStateProps {
  message: string;
  code?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, code, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-danger-050 bg-white px-6 py-10 text-center shadow-card"
    >
      <AlertTriangle className="h-8 w-8 text-danger-700" strokeWidth={2} aria-hidden="true" />
      <p className="max-w-sm text-[15px] text-ink-900">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
      {code && <p className="text-xs text-ink-600">{code}</p>}
    </div>
  );
}
