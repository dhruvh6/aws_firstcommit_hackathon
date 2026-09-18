/**
 * S6 - Match results, the WOW screen (docs/06-UI-SPEC.md § 9). OWNER: M1.
 *
 * Reads the exact TanStack cache key S5 primes on submit
 * (api/queries.ts's requirementMatchesKey) via useRequirementMatches, so a
 * requirement just posted from RequirementNewPage renders here with no
 * second request and no loading flash - the demo's 1:35 WOW moment. A
 * direct visit (refresh, shared link) still fetches normally and shows the
 * skeleton below.
 *
 * All six checks always render, pass and fail alike (docs/03 § 2); `score`
 * is never read or displayed (docs/03 § 6). Near-misses are collapsed by
 * default and never carry a reserve box - MatchCard enforces both from
 * `match.compatible` alone.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, CircleCheck, PackageSearch } from 'lucide-react';
import { label } from '@dse/shared';
import { ApiError } from '../api/client.js';
import { useRequirementMatches } from '../api/queries.js';
import { MatchCard } from '../components/MatchCard.js';
import { StatusChip } from '../components/StatusChip.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { formatDate, formatQuantity } from '../lib/format.js';

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-10">
      <Skeleton variant="text" className="h-8 w-72" />
      <Skeleton variant="text" className="h-5 w-96" />
      <Skeleton variant="card" className="h-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton variant="card" className="h-40" />
        <Skeleton variant="card" className="h-40" />
      </div>
    </div>
  );
}

export function RequirementMatchesPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchesQuery = useRequirementMatches(id);
  const [showReasons, setShowReasons] = useState(false);

  if (matchesQuery.isPending) {
    return <PageSkeleton />;
  }

  if (matchesQuery.isError) {
    const error = matchesQuery.error;

    if (error instanceof ApiError && error.code === 'NOT_YOUR_REQUIREMENT') {
      return (
        <div className="mx-auto max-w-[1280px] px-6 py-10">
          <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
            Match results
          </h1>
          <div className="mt-6">
            <ErrorState message='This requirement belongs to another business. Switch "Acting as" in the top bar to the business that posted it.' />
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Match results
        </h1>
        <div className="mt-6">
          <ErrorState
            message={error instanceof ApiError ? error.message : 'Cannot reach the exchange. Try again.'}
            code={error instanceof ApiError ? error.code : undefined}
            onRetry={() => void matchesQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const { requirement, items } = matchesQuery.data;
  const compatible = items.filter((m) => m.compatible);
  const nearMisses = items.filter((m) => !m.compatible);
  const remaining = Math.max(0, requirement.requestedQuantity - requirement.reservedQuantity - requirement.fulfilledQuantity);
  const fullyCovered = remaining <= 0;
  const categoryLabel = label('category', requirement.category) ?? requirement.category;

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        {categoryLabel}
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[15px] text-ink-700">
        <span>{formatQuantity(requirement.requestedQuantity, requirement.unit)} needed by {formatDate(requirement.requiredBy)}</span>
        <span aria-hidden="true">·</span>
        <span>within {requirement.radiusKm} km</span>
        <span aria-hidden="true">·</span>
        <StatusChip kind="requirementStatus" status={requirement.status} />
      </p>
      <p className="mt-1 text-[15px] text-ink-700">
        Reserved {formatQuantity(requirement.reservedQuantity, requirement.unit)} · Fulfilled{' '}
        {formatQuantity(requirement.fulfilledQuantity, requirement.unit)} · Remaining{' '}
        {formatQuantity(remaining, requirement.unit)}
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {fullyCovered ? (
          <EmptyState
            icon={CircleCheck}
            title="Fully covered"
            body="Your requirement is fully covered by existing reservations."
          />
        ) : compatible.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No compatible surplus right now"
            body="Nothing nearby meets every requirement yet. Try posting a different requirement, or check back as new surplus is listed."
            actions={[{ label: 'Post a different requirement', onClick: () => navigate('/requirements/new') }]}
          />
        ) : (
          <section>
            <h2 className="flex items-center gap-2 text-[20px] font-semibold leading-7 text-ink-900">
              <Check className="h-5 w-5 text-ok-700" strokeWidth={2} aria-hidden="true" />
              {compatible.length} compatible match{compatible.length === 1 ? '' : 'es'} found
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              {compatible.map((match, index) => (
                <MatchCard
                  key={match.listingId}
                  match={match}
                  requirementId={requirement.requirementId}
                  remainingRequirement={remaining}
                  animationIndex={index}
                />
              ))}
            </div>
          </section>
        )}

        {nearMisses.length > 0 && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 pt-6">
              <h2 className="text-[15px] font-semibold text-ink-700">
                {nearMisses.length} nearby listing{nearMisses.length === 1 ? '' : 's'} did not match
              </h2>
              <button
                type="button"
                aria-expanded={showReasons}
                onClick={() => setShowReasons((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[15px] font-semibold text-brand-600 hover:underline"
              >
                {showReasons ? 'Hide reasons' : 'Show reasons'}
                {showReasons ? (
                  <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                )}
              </button>
            </div>
            {showReasons && (
              <div className="mt-4 flex flex-col gap-3">
                {nearMisses.map((match) => (
                  <MatchCard
                    key={match.listingId}
                    match={match}
                    requirementId={requirement.requirementId}
                    remainingRequirement={remaining}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
