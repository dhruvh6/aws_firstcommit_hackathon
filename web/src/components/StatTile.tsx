/**
 * StatTile - docs/07-DESIGN-SYSTEM.md § 4 component table: label, value,
 * unit, optional delta, optional sparkline; default, loading skeleton,
 * no-data (`—`, never `0`) states. OWNER: M1.
 *
 * `value` already carries its unit (formatted by the caller via
 * `formatQuantity`/`formatInr`/a bare number) - this component only decides
 * whether to render it or fall back to an em dash for `null`/`undefined`.
 * A genuine `0` is never treated as "no data" (docs/06 § 13).
 *
 * The optional tooltip trigger is a focusable button, not a hover-only
 * title attribute, so the `estimatedProcurementAvoidedInr` disclosure
 * (docs/04 § 3) is reachable by keyboard.
 */
import { useId, useState } from 'react';
import { Info } from 'lucide-react';
import { Skeleton } from './Skeleton.js';

export interface StatTileProps {
  value: string | number | null | undefined;
  label: string;
  tooltip?: string;
  loading?: boolean;
}

export function StatTile({ value, label, tooltip, loading = false }: StatTileProps): React.JSX.Element {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = useId();

  if (loading) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-white p-4 shadow-card">
        <Skeleton variant="text" className="h-8 w-16" />
        <Skeleton variant="text" className="h-4 w-24" />
      </div>
    );
  }

  const display = value === null || value === undefined ? '—' : value;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-ink-200 bg-white p-4 shadow-card">
      <p className="text-2xl font-bold leading-8 text-ink-900">{display}</p>
      <p className="flex items-center gap-1 text-[13px] text-ink-600">
        <span>{label}</span>
        {tooltip && (
          <span className="relative inline-flex">
            <button
              type="button"
              aria-describedby={tooltipOpen ? tooltipId : undefined}
              onFocus={() => setTooltipOpen(true)}
              onBlur={() => setTooltipOpen(false)}
              onMouseEnter={() => setTooltipOpen(true)}
              onMouseLeave={() => setTooltipOpen(false)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-500 hover:text-ink-700"
            >
              <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              <span className="sr-only">More about this figure</span>
            </button>
            {tooltipOpen && (
              <span
                id={tooltipId}
                role="tooltip"
                className="absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-md bg-ink-900 px-2.5 py-1.5 text-[12px] leading-4 text-white shadow-hover"
              >
                {tooltip}
              </span>
            )}
          </span>
        )}
      </p>
    </div>
  );
}
