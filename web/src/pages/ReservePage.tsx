/**
 * S7 - Reservation review (docs/06-UI-SPEC.md § 10). OWNER: M1.
 *
 * Reads `listingId`/`requirementId?`/`qty` from the URL (MatchCard.tsx
 * navigates here). The listing comes from GET /v1/listings/{id}; the
 * requirement and this listing's six checks come from the same
 * requirementMatchesKey cache S6 reads (api/queries.ts), so arriving from
 * a MatchCard's Reserve button costs no second fetch. There is no
 * requirement-detail endpoint (docs/04 § 2 cut-route rule) - the matches
 * endpoint is the only source for requirement data on this page.
 *
 * The server recomputes every check at confirm time and never trusts this
 * page's view of compatibility (docs/04 § 3) - every error code in
 * docs/06 § 10's table is handled inline below, never a generic toast.
 */
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  InsufficientQuantityDetails,
  MatchCheck,
  MatchCheckCode,
  NotCompatibleDetails,
} from '@dse/shared';
import { label } from '@dse/shared';
import { ApiError, createReservation } from '../api/client.js';
import { requirementMatchesKey, useListing, useRequirementMatches } from '../api/queries.js';
import { toast } from '../state/toast.js';
import { Button } from '../components/Button.js';
import { CheckList } from '../components/CheckList.js';
import { StatusChip } from '../components/StatusChip.js';
import { QuantityStepper } from '../components/QuantityStepper.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { formatDate, formatQuantity } from '../lib/format.js';

const TERMINAL_ERROR_CODES = new Set([
  'INVALID_STATE',
  'LISTING_NOT_AVAILABLE',
  'SELF_RESERVATION',
  'NOT_COMPATIBLE',
  'LISTING_NOT_FOUND',
  'REQUIREMENT_NOT_FOUND',
]);

interface BannerError {
  code: string;
  message: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <Skeleton variant="text" className="h-8 w-64" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Skeleton variant="card" className="h-40" />
          <Skeleton variant="card" className="h-56" />
        </div>
        <Skeleton variant="card" className="h-80" />
      </div>
    </div>
  );
}

export function ReservePage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const listingId = searchParams.get('listingId');
  const requirementId = searchParams.get('requirementId') ?? undefined;
  const qtyParam = Number(searchParams.get('qty'));
  const paramsValid = Boolean(listingId) && Number.isFinite(qtyParam) && qtyParam > 0;

  const listingQuery = useListing(paramsValid ? (listingId as string) : undefined);
  const matchesQuery = useRequirementMatches(paramsValid ? requirementId : undefined);

  const [quantity, setQuantity] = useState<number>(paramsValid ? qtyParam : 1);
  const [maxOverride, setMaxOverride] = useState<number | null>(null);
  const [failedChecks, setFailedChecks] = useState<MatchCheckCode[] | null>(null);
  const [bannerError, setBannerError] = useState<BannerError | null>(null);

  const mutation = useMutation({
    mutationFn: createReservation,
    meta: { silentErrorToast: true },
    onSuccess: (response) => {
      const { reservation, listing: updatedListing, requirement: updatedRequirement } = response;
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      if (requirementId) void queryClient.invalidateQueries({ queryKey: requirementMatchesKey(requirementId) });
      toast.success(
        `${formatQuantity(reservation.reservedQuantity, reservation.unit)} reserved. ${reservation.supplierBusinessName} will confirm handoff.`,
      );
      navigate(`/reservations/${reservation.reservationId}`, {
        state: { reservation, listing: updatedListing, requirement: updatedRequirement },
      });
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setBannerError({ code: 'NETWORK_ERROR', message: 'Cannot reach the exchange. Try again.' });
        return;
      }
      if (error.code === 'INSUFFICIENT_QUANTITY') {
        const details = error.details as InsufficientQuantityDetails | null;
        if (details) setMaxOverride(details.availableQuantity);
        setBannerError({ code: error.code, message: error.message });
        return;
      }
      if (error.code === 'EXCEEDS_REQUIREMENT') {
        const details = error.details as { remainingRequirement?: number } | null;
        if (details?.remainingRequirement !== undefined) setMaxOverride(details.remainingRequirement);
        setBannerError({ code: error.code, message: error.message });
        return;
      }
      if (error.code === 'NOT_COMPATIBLE') {
        const details = error.details as NotCompatibleDetails | null;
        setFailedChecks(details?.failedChecks ?? []);
        setBannerError({
          code: error.code,
          message: 'This listing has changed since you viewed it and no longer matches your requirement.',
        });
        return;
      }
      if (error.code === 'SELF_RESERVATION') {
        setBannerError({
          code: error.code,
          message: `${error.message}. Switch "Acting as" in the top bar to a different business.`,
        });
        return;
      }
      setBannerError({ code: error.code, message: error.message });
    },
  });

  if (!paramsValid) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Reservation review
        </h1>
        <div className="mt-6">
          <ErrorState message="Missing reservation details. Go back and try reserving again." />
        </div>
      </div>
    );
  }

  const isLoading = listingQuery.isPending || (Boolean(requirementId) && matchesQuery.isPending);
  if (isLoading) return <PageSkeleton />;

  if (listingQuery.isError) {
    const error = listingQuery.error;
    const message =
      error instanceof ApiError && error.code === 'LISTING_NOT_FOUND'
        ? 'This listing no longer exists.'
        : error instanceof ApiError
          ? error.message
          : 'Cannot reach the exchange. Try again.';
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Reservation review
        </h1>
        <div className="mt-6">
          <ErrorState message={message} onRetry={() => void listingQuery.refetch()} />
        </div>
      </div>
    );
  }

  if (requirementId && matchesQuery.isError) {
    const error = matchesQuery.error;
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Reservation review
        </h1>
        <div className="mt-6">
          <ErrorState
            message={
              error instanceof ApiError
                ? error.message
                : 'Could not load why this listing matches your requirement.'
            }
            code={error instanceof ApiError ? error.code : undefined}
            onRetry={() => void matchesQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const listing = listingQuery.data;
  const requirement = requirementId ? (matchesQuery.data?.requirement ?? null) : null;
  const match = requirementId ? matchesQuery.data?.items.find((m) => m.listingId === listingId) : undefined;

  // A requirement is linked but this listing isn't in its match set (stale cache,
  // truncation, etc.) - the buyer must see the six reasons before reserving
  // against a requirement, so this blocks the same as a fetch failure would.
  if (requirementId && !match) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Reservation review
        </h1>
        <div className="mt-6">
          <ErrorState
            message="We could not load why this listing matches your requirement. Go back and try again."
          />
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate(`/requirements/${requirementId}/matches`)}>
              Back to matches
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const remainingRequirement = requirement
    ? Math.max(0, round2(requirement.requestedQuantity - requirement.reservedQuantity - requirement.fulfilledQuantity))
    : Infinity;
  const step = listing.unit === 'KG' ? 0.5 : 1;
  const baseMax = requirement ? Math.min(listing.availableQuantity, remainingRequirement) : listing.availableQuantity;
  const effectiveMax = maxOverride !== null ? Math.min(maxOverride, baseMax) : baseMax;

  const displayChecks: MatchCheck[] | undefined = match?.checks.map((check) =>
    failedChecks?.includes(check.code) ? { ...check, passed: false } : check,
  );

  const distanceKm = match?.distanceKm ?? listing.distanceKm;
  const isTerminalError = bannerError !== null && TERMINAL_ERROR_CODES.has(bannerError.code);
  const disableConfirm = mutation.isPending || quantity <= 0 || quantity > effectiveMax || isTerminalError;

  function handleQuantityChange(next: number): void {
    setQuantity(next);
    setBannerError(null);
  }

  function handleBack(): void {
    if (location.key === 'default') {
      navigate(requirementId ? `/requirements/${requirementId}/matches` : '/');
      return;
    }
    navigate(-1);
  }

  function handleConfirm(): void {
    if (disableConfirm) return;
    mutation.mutate({
      listingId: listing.listingId,
      requirementId,
      reservedQuantity: quantity,
    });
  }

  const supplierKeeps = Math.max(0, round2(listing.availableQuantity - quantity));

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        Review your reservation
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Material</h2>
            <h3 className="mt-2 text-base font-semibold text-ink-900">{listing.title}</h3>
            <p className="mt-0.5 text-[13px] text-ink-600">
              {listing.businessName} · {listing.area}
              {distanceKm !== undefined ? ` · ${distanceKm} km` : ''}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-ink-900">
              <span className="font-semibold">{formatQuantity(listing.availableQuantity, listing.unit)} available</span>
              <StatusChip kind="condition" status={listing.condition} />
              <span className="text-ink-600">until {formatDate(listing.availableUntil)}</span>
            </p>

            <div className="mt-4">
              <span className="text-[13px] font-semibold text-ink-700">Quantity</span>
              <div className="mt-1.5">
                <QuantityStepper
                  value={quantity}
                  min={step}
                  max={effectiveMax}
                  step={step}
                  unit={listing.unit}
                  onChange={handleQuantityChange}
                />
              </div>
              {bannerError?.code === 'EXCEEDS_REQUIREMENT' && (
                <p className="mt-1.5 text-[13px] text-danger-700">{bannerError.message}</p>
              )}
            </div>
          </div>

          {requirement && (
            <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">
                Against requirement
              </h2>
              <p className="mt-2 text-[15px] text-ink-900">
                {label('category', requirement.category) ?? requirement.category} ·{' '}
                {formatQuantity(requirement.requestedQuantity, requirement.unit)} by {formatDate(requirement.requiredBy)}
              </p>
              <p className="mt-1 text-[13px] text-ink-600">
                Remaining after this: {formatQuantity(Math.max(0, round2(remainingRequirement - quantity)), requirement.unit)}
              </p>
            </div>
          )}

          {displayChecks && (
            <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Why this matches</h2>
              <div className="mt-3">
                <CheckList checks={displayChecks} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-white p-5 shadow-card">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Summary</h2>

          {bannerError && !['EXCEEDS_REQUIREMENT'].includes(bannerError.code) && (
            <div role="alert" className="rounded-md border border-danger-050 bg-danger-050 px-3 py-2 text-[13px] text-danger-700">
              {bannerError.message}
              {bannerError.code === 'LISTING_NOT_AVAILABLE' && (
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate('/browse')}>
                    Browse other surplus
                  </Button>
                </div>
              )}
            </div>
          )}

          <dl className="flex flex-col gap-2 text-[15px]">
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Reserving</dt>
              <dd className="font-semibold text-ink-900">{formatQuantity(quantity, listing.unit)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Of available</dt>
              <dd className="text-ink-900">{formatQuantity(listing.availableQuantity, listing.unit)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Supplier keeps</dt>
              <dd className="text-ink-900">{formatQuantity(supplierKeeps, listing.unit)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Handoff</dt>
              <dd className="text-ink-900">{label('handoffMode', listing.handoffMode) ?? listing.handoffMode}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Hold</dt>
              <dd className="text-ink-900">48 hours after you confirm</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-600">Payment</dt>
              <dd className="text-ink-900">None</dd>
            </div>
          </dl>

          <Button variant="primary" fullWidth loading={mutation.isPending} disabled={disableConfirm} onClick={handleConfirm}>
            Confirm reservation
          </Button>
          <Button variant="ghost" fullWidth onClick={handleBack} disabled={mutation.isPending}>
            Back
          </Button>

          <p className="text-[13px] text-ink-600">
            No money changes hands in DeadStock Exchange. You are holding material for pickup.
          </p>
        </div>
      </div>
    </div>
  );
}
