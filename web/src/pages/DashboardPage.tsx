/**
 * S8 - My Dashboard (docs/06-UI-SPEC.md § 11). OWNER: M1.
 *
 * Three tabs, not the mockup's four: `GET /v1/requirements`, listing
 * withdraw, listing-matches and reservation-cancel are all cut
 * (docs/04 § 2), so there is no "My Requirements" tab and no
 * Matches/Withdraw/Cancel actions anywhere below - removed rather than
 * wired to routes that do not exist (docs/06 § 2).
 *
 * All three tab queries run unconditionally so every tab's count badge is
 * always current, with no extra endpoint (docs/06 § 11: "Tab counts come
 * from the same queries that populate the tables").
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookmarkCheck, Handshake, Package } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ListingsResponse, Reservation, ReservationsResponse } from '@dse/shared';
import { label } from '@dse/shared';
import { ApiError } from '../api/client.js';
import { useHandoffReservation, useListing, useListings, useReservations } from '../api/queries.js';
import { AllocationBar } from '../components/AllocationBar.js';
import { Button } from '../components/Button.js';
import { Dialog } from '../components/Dialog.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { StatusChip } from '../components/StatusChip.js';
import { Tabs } from '../components/Tabs.js';
import type { TabItem } from '../components/Tabs.js';
import { formatDate, formatDateTime, formatQuantity } from '../lib/format.js';

type TabValue = 'listings' | 'incoming' | 'reservations';
const TAB_VALUES: TabValue[] = ['listings', 'incoming', 'reservations'];

function isTabValue(value: string | null): value is TabValue {
  return value !== null && (TAB_VALUES as string[]).includes(value);
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Cannot reach the exchange. Try again.';
}

function RowsSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton variant="row" />
      <Skeleton variant="row" />
      <Skeleton variant="row" />
    </div>
  );
}

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <Skeleton variant="text" className="h-8 w-48" />
      <div className="mt-6 flex gap-4 border-b border-ink-200 pb-3">
        <Skeleton variant="text" className="h-6 w-24" />
        <Skeleton variant="text" className="h-6 w-24" />
        <Skeleton variant="text" className="h-6 w-32" />
      </div>
      <div className="mt-6">
        <RowsSkeleton />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// My listings
// ---------------------------------------------------------------------------

function MyListingsPanel({ query }: { query: UseQueryResult<ListingsResponse> }): React.JSX.Element {
  const navigate = useNavigate();

  if (query.isPending) return <RowsSkeleton />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const items = query.data.items;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No listings yet"
        body="List your surplus material so nearby businesses can find and reserve it."
        actions={[{ label: 'List surplus', onClick: () => navigate('/listings/new'), variant: 'primary' }]}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((listing) => (
        <div
          key={listing.listingId}
          className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-card sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink-900">{listing.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-600">
              <span>{formatQuantity(listing.availableQuantity, listing.unit)} available</span>
              <span>{formatQuantity(listing.reservedQuantity, listing.unit)} reserved</span>
              <span>{formatQuantity(listing.handedOffQuantity, listing.unit)} handed off</span>
              <span>until {formatDate(listing.availableUntil)}</span>
            </p>
            {(listing.reservedQuantity > 0 || listing.handedOffQuantity > 0) && (
              <div className="mt-2 max-w-xs">
                <AllocationBar
                  available={listing.availableQuantity}
                  reserved={listing.reservedQuantity}
                  handedOff={listing.handedOffQuantity}
                  unit={listing.unit}
                />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusChip kind="listingStatus" status={listing.status} />
            <Link to={`/listings/${listing.listingId}`} className="text-[14px] font-semibold text-brand-600 hover:underline">
              View
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incoming (supplier-side RESERVED rows)
// ---------------------------------------------------------------------------

interface IncomingRowProps {
  reservation: Reservation;
  titleFromMap: string | undefined;
  onConfirm: (reservationId: string) => void;
}

function IncomingRow({ reservation, titleFromMap, onConfirm }: IncomingRowProps): React.JSX.Element {
  // Every incoming reservation is against the acting business's own listing,
  // so the title almost always comes free from the My-listings map below -
  // this per-row fetch only fires for the rare id that map doesn't have yet.
  const fallbackQuery = useListing(titleFromMap === undefined ? reservation.listingId : undefined);
  const title = titleFromMap ?? fallbackQuery.data?.title ?? (label('category', reservation.category) ?? reservation.category);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-card sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink-900">
          {formatQuantity(reservation.reservedQuantity, reservation.unit)} · {title}
        </p>
        <p className="mt-1 text-[13px] text-ink-600">To {reservation.buyerBusinessName}</p>
        <p className="mt-1 text-[13px] text-ink-600">
          Reserved {formatDateTime(reservation.createdAt)} · Hold expires {formatDateTime(reservation.expiresAt)} ·{' '}
          {label('handoffMode', reservation.handoffMode) ?? reservation.handoffMode}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Button variant="primary" size="sm" onClick={() => onConfirm(reservation.reservationId)}>
          Confirm handoff
        </Button>
        <Link to={`/reservations/${reservation.reservationId}`} className="text-[14px] font-semibold text-brand-600 hover:underline">
          View
        </Link>
      </div>
    </div>
  );
}

interface IncomingPanelProps {
  query: UseQueryResult<ReservationsResponse>;
  listingTitleById: Map<string, string>;
  onConfirm: (reservationId: string) => void;
}

function IncomingPanel({ query, listingTitleById, onConfirm }: IncomingPanelProps): React.JSX.Element {
  if (query.isPending) return <RowsSkeleton />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const items = query.data.items;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="No incoming reservations"
        body="When a buyer reserves your surplus, it will show up here for you to confirm handoff."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((reservation) => (
        <IncomingRow
          key={reservation.reservationId}
          reservation={reservation}
          titleFromMap={listingTitleById.get(reservation.listingId)}
          onConfirm={onConfirm}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// My reservations (buyer-side)
// ---------------------------------------------------------------------------

function MyReservationRow({ reservation }: { reservation: Reservation }): React.JSX.Element {
  // Buyer side has no equivalent to the mine=true listings map (these are
  // other businesses' listings), so this reuses the same ['listings', id]
  // cache S7/S9 already populate.
  const listingQuery = useListing(reservation.listingId);
  const title = listingQuery.data?.title;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-card sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {title ? (
          <p className="text-[15px] font-semibold text-ink-900">{title}</p>
        ) : (
          <Skeleton variant="text" className="h-5 w-40" />
        )}
        <p className="mt-1 text-[13px] text-ink-600">
          {formatQuantity(reservation.reservedQuantity, reservation.unit)} from {reservation.supplierBusinessName}
        </p>
        {reservation.status === 'RESERVED' && (
          <p className="mt-1 text-[13px] text-ink-600">Hold expires {formatDateTime(reservation.expiresAt)}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusChip kind="reservationStatus" status={reservation.status} />
        <Link to={`/reservations/${reservation.reservationId}`} className="text-[14px] font-semibold text-brand-600 hover:underline">
          View
        </Link>
      </div>
    </div>
  );
}

function MyReservationsPanel({ query }: { query: UseQueryResult<ReservationsResponse> }): React.JSX.Element {
  const navigate = useNavigate();

  if (query.isPending) return <RowsSkeleton />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const items = query.data.items;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BookmarkCheck}
        title="No reservations yet"
        body="Post a requirement and reserve matching surplus to see it here."
        actions={[{ label: 'Post a requirement', onClick: () => navigate('/requirements/new'), variant: 'primary' }]}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((reservation) => (
        <MyReservationRow key={reservation.reservationId} reservation={reservation} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const listingsQuery = useListings({ mine: true });
  const incomingQuery = useReservations({ role: 'SUPPLIER', status: ['RESERVED'] });
  const reservationsQuery = useReservations({ role: 'BUYER' });
  const handoffMutation = useHandoffReservation();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const listingTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const listing of listingsQuery.data?.items ?? []) map.set(listing.listingId, listing.title);
    return map;
  }, [listingsQuery.data]);

  const tabParam = searchParams.get('tab');
  const explicitTab = isTabValue(tabParam) ? tabParam : null;
  const resolvingDefault = !explicitTab && incomingQuery.isPending;
  const defaultTab: TabValue = (incomingQuery.data?.meta.count ?? 0) > 0 ? 'incoming' : 'listings';
  const activeTab: TabValue = explicitTab ?? defaultTab;

  function handleTabChange(next: string): void {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  }

  if (resolvingDefault) return <PageSkeleton />;

  const confirmingReservation = incomingQuery.data?.items.find((r) => r.reservationId === confirmingId) ?? null;

  const tabs: TabItem[] = [
    { value: 'listings', label: 'My listings', count: listingsQuery.data?.meta.count, panelId: 'dashboard-panel-listings' },
    {
      value: 'incoming',
      label: 'Incoming',
      count: incomingQuery.data?.meta.count,
      urgent: true,
      panelId: 'dashboard-panel-incoming',
    },
    {
      value: 'reservations',
      label: 'My reservations',
      count: reservationsQuery.data?.meta.count,
      panelId: 'dashboard-panel-reservations',
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        My dashboard
      </h1>

      <div className="mt-6">
        <Tabs tabs={tabs} value={activeTab} onChange={handleTabChange} />
      </div>

      <div className="mt-6">
        {activeTab === 'listings' && (
          <div id="dashboard-panel-listings" role="tabpanel" aria-labelledby="dashboard-panel-listings-tab">
            <MyListingsPanel query={listingsQuery} />
          </div>
        )}
        {activeTab === 'incoming' && (
          <div id="dashboard-panel-incoming" role="tabpanel" aria-labelledby="dashboard-panel-incoming-tab">
            <IncomingPanel query={incomingQuery} listingTitleById={listingTitleById} onConfirm={setConfirmingId} />
          </div>
        )}
        {activeTab === 'reservations' && (
          <div id="dashboard-panel-reservations" role="tabpanel" aria-labelledby="dashboard-panel-reservations-tab">
            <MyReservationsPanel query={reservationsQuery} />
          </div>
        )}
      </div>

      <Dialog
        open={confirmingReservation !== null}
        title="Confirm handoff"
        body={
          confirmingReservation
            ? `Confirm that ${formatQuantity(confirmingReservation.reservedQuantity, confirmingReservation.unit)} was physically handed over to ${confirmingReservation.buyerBusinessName}. This records the reuse and cannot be undone.`
            : ''
        }
        confirmLabel="Confirm handoff"
        cancelLabel="Not yet"
        loading={handoffMutation.isPending}
        onConfirm={() => {
          if (!confirmingReservation) return;
          handoffMutation.mutate(
            { reservationId: confirmingReservation.reservationId },
            {
              onSuccess: () => setConfirmingId(null),
              onError: () => setConfirmingId(null),
            },
          );
        }}
        onCancel={() => setConfirmingId(null)}
      />
    </div>
  );
}
