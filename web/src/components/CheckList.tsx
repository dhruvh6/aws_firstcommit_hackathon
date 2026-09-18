/**
 * CheckList - the signature component (docs/07-DESIGN-SYSTEM.md § 4 "CheckList
 * - the signature component"). Renders `MatchCheck[]` in the given order,
 * always all six, pass and fail alike (docs/06 § 9 non-negotiable #1).
 * OWNER: M1.
 */
import { Check, X } from 'lucide-react';
import type { MatchCheck } from '@dse/shared';

export interface CheckListProps {
  checks: MatchCheck[];
}

export function CheckList({ checks }: CheckListProps): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((check) => (
        <li key={check.code} className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            {check.passed ? (
              <Check className="h-4 w-4 text-ok-700" strokeWidth={2} aria-hidden="true" />
            ) : (
              <X className="h-4 w-4 text-danger-700" strokeWidth={2} aria-hidden="true" />
            )}
          </span>
          {/* detail is server-rendered verbatim (docs/03 § 7) - never reworded, never truncated. */}
          <span className={`whitespace-normal text-[15px] leading-[22px] ${check.passed ? 'text-ok-700' : 'text-danger-700'}`}>
            {check.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
