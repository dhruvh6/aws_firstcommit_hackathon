/**
 * S9 - Reservation detail & handoff, minimal build (docs/06-UI-SPEC.md § 12).
 * OWNER: M1.
 *
 * There is no per-id endpoint (docs/06 § 2 cut-route rule): S7 passes its
 * POST /v1/reservations response via router state so arriving from the
 * Confirm button costs no fetch; any other arrival (refresh, bookmark)
 * falls back to finding this id inside GET /v1/reservations. `matchReasons`
 * renders from the reservation's frozen snapshot only, never re-derived
 * (docs/02 § 7). No cancel button, no timeline (both out of this minimal
 * scope / cut).
 */
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Reservation, SurplusListing } from '@dse/shared';
import { label } from '@dse/shared';
import { ApiError, handoffReservation } from '../api/client.js';
import { useListing, useReservations } from '../api/queries.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { Button } from '../components/Button.js';
import { CheckList } from '../components/CheckList.js';
import { Dialog } from '../components/Dialog.js';
import { StatusChip } from '../components/StatusChip.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { formatDateTime, formatQuantity } from '../lib/format.js';

interface RouterState {
  reservation: Reservation;
  listing: SurplusListing;
}

function isRouterState(value: unknown): value is RouterState {
  return typeof value === 'object' && value !== null && 'reservation' in value && 'listing' in value;
}

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <Skeleton variant="text" className="h-8 w-64" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton variant="card" className="h-64" />
        <Skeleton variant="card" className="h-48" />
      </div>
    </div>
  );
}

export function ReservationDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const acting = useActingBusiness();
  const queryClient = useQueryClient();

  const routerState = isRouterState(location.state) && location.state.reservation.reservationId === id
    ? location.state
    : null;

  const [freshEnvelope, setFreshEnvelope] = useState<RouterState | null>(routerState);
  const [dialogOpen, setDialogOpen] = useState(false);

  const listQuery = useReservations();
  const listed = listQuery.data?.items.find((r) => r.reservationId === id);
  const reservation = freshEnvelope?.reservation ?? listed ?? null;

  const listingQuery = useListing(reservation?.listingId);
  const listingTitle = freshEnvelope?.listing.title ?? listingQuery.data?.title;

  const handoffMutation = useMutation({
    mutationFn: () => handoffReservation(id as string),
    onSuccess: (response) => {
      setFreshEnvelope({ reservation: response.reservation, listing: response.listing });
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['impact'] });
    },
    onError: () => setDialogOpen(false),
  });

  const stillLoading = !reservation && listQuery.isPending;
  if (stillLoading) return <PageSkeleton />;

  if (!reservation) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Reservation detail
        </h1>
        <div className="mt-6">
          {listQuery.isError ? (
            <ErrorState
              message={
                listQuery.error instanceof ApiError
                  ? listQuery.error.message
                  : 'Cannot reach the exchange. Try again.'
              }
              onRetry={() => void listQuery.refetch()}
            />
          ) : (
            <ErrorState message="Reservation not found." />
          )}
        </div>
      </div>
    );
  }

  const canConfirmHandoff =
    acting.status === 'ready' &&
    acting.business.businessId === reservation.supplierBusinessId &&
    reservation.status === 'RESERVED';
  const isHandedOff = reservation.status === 'HANDED_OFF';

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Reservation {reservation.reservationId}
        </h1>
        <StatusChip kind="reservationStatus" status={reservation.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
            <p className="text-[15px] font-semibold text-ink-900">
              {formatQuantity(reservation.reservedQuantity, reservation.unit)} ·{' '}
              {label('category', reservation.category) ?? reservation.category}
            </p>
            {listingTitle ? (
              <p className="mt-0.5 text-[15px] text-ink-900">{listingTitle}</p>
            ) : (
              <Skeleton variant="text" className="mt-1 h-5 w-48" />
            )}
            <p className="mt-2 text-[13px] text-ink-600">
              From {reservation.supplierBusinessName} · To {reservation.buyerBusinessName}
            </p>
            <p className="mt-1 text-[13px] text-ink-600">
              {label('handoffMode', reservation.handoffMode) ?? reservation.handoffMode}
              {reservation.status === 'RESERVED' && <> · Hold expires {formatDateTime(reservation.expiresAt)}</>}
            </p>
            {freshEnvelope && (
              <p className="mt-1 text-[13px] text-ink-600">
                Supplier keeps {formatQuantity(freshEnvelope.listing.availableQuantity, freshEnvelope.listing.unit)}
              </p>
            )}
          </div>

          {reservation.matchReasons.length > 0 && (
            <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">
                Why this matched (recorded at reservation)
              </h2>
              <div className="mt-3">
                <CheckList checks={reservation.matchReasons} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-white p-5 shadow-card">
          {isHandedOff ? (
            <div className="rounded-md border border-ok-050 bg-ok-050 p-3">
              <p className="text-[15px] font-semibold text-ok-700">
                {formatQuantity(reservation.reservedQuantity, reservation.unit)} recorded as reused
              </p>
              <Link to="/impact" className="mt-1 inline-block text-[13px] font-semibold text-brand-600 hover:underline">
                See the impact dashboard
              </Link>
            </div>
          ) : canConfirmHandoff ? (
            <Button variant="primary" fullWidth onClick={() => setDialogOpen(true)}>
              Confirm handoff
            </Button>
          ) : reservation.status === 'RESERVED' ? (
            <div>
              <p className="text-[15px] text-ink-700">
                Waiting for {reservation.supplierBusinessName} to confirm handoff.
              </p>
              <p className="mt-1 text-[13px] text-ink-600">
                Hold expires {formatDateTime(reservation.expiresAt)}.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        title="Confirm handoff"
        body={`Confirm that ${formatQuantity(reservation.reservedQuantity, reservation.unit)} was physically handed over. This cannot be undone.`}
        confirmLabel="Confirm handoff"
        cancelLabel="Not yet"
        loading={handoffMutation.isPending}
        onConfirm={() => handoffMutation.mutate()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
