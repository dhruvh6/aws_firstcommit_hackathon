/**
 * BusinessSwitcher - docs/06-UI-SPEC.md § 3 "Business switcher": the P0
 * identity mechanism. Deliberately a plain labelled dropdown, never an
 * avatar or login control, so it reads as a stated omission of auth, not
 * a bug.
 * OWNER: M1.
 */
import { useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../components/Skeleton.js';
import { setActingBusiness, useActingBusiness } from '../state/actingBusiness.js';

export interface BusinessSwitcherProps {
  /**
   * docs/06-UI-SPEC.md § 14 <640px fix: on the stacked mobile "Acting as"
   * row the select must take the remaining row width and truncate, never
   * force a fixed width that overflows the viewport.
   */
  fullWidth?: boolean;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function BusinessSwitcher({ fullWidth = false }: BusinessSwitcherProps): React.JSX.Element {
  const state = useActingBusiness();
  const queryClient = useQueryClient();
  const selectId = useId();

  const rootClasses = cx('flex min-w-0 items-center gap-2', fullWidth ? 'flex-1' : 'shrink-0');

  if (state.status === 'loading') {
    return (
      <div className={rootClasses}>
        <span className="shrink-0 text-[13px] text-brand-100">Acting as</span>
        <div className={cx('min-w-0', fullWidth ? 'flex-1' : 'w-56')}>
          <Skeleton variant="row" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={cx(rootClasses, 'text-[13px] text-white')}>
        <span className="truncate">Couldn&apos;t load businesses.</span>
        <button type="button" onClick={state.retry} className="shrink-0 font-semibold underline">
          Retry
        </button>
      </div>
    );
  }

  const { business, businesses } = state;

  return (
    <div className={rootClasses}>
      <label htmlFor={selectId} className="shrink-0 text-[13px] text-brand-100">
        Acting as
      </label>
      <select
        id={selectId}
        value={business.businessId}
        onChange={(event) => setActingBusiness(event.target.value, queryClient)}
        className={cx(
          'h-9 min-w-0 truncate rounded-md border border-brand-500 bg-white px-2 text-[13px] text-ink-900',
          fullWidth ? 'flex-1' : 'w-56',
        )}
      >
        {businesses.map((candidate) => (
          <option key={candidate.businessId} value={candidate.businessId}>
            {candidate.name} · {candidate.businessType} · {candidate.area}
          </option>
        ))}
      </select>
    </div>
  );
}
