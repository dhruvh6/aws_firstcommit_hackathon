/**
 * S3 - Listing detail (docs/06-UI-SPEC.md § 6). OWNER: M1.
 *
 * Minimal pass: no gallery, no "similar surplus" rail, no requirement
 * selector - the requirement selector needs `GET /v1/requirements` (mine),
 * which is cut (docs/04 § 2). `Reserve` therefore always navigates without
 * a `requirementId` (`/reserve?listingId=&qty=`); a buyer who wants this
 * against a specific requirement still gets there via S6's MatchCard.
 *
 * The attribute table renders `meta.categories[category].attributeFields`
 * generically, one row per field - no per-category special casing (not
 * even the mockup's combined "Piece size 15-40 cm" row), matching docs/06
 * § 7's "no hardcoded field lists in components" rule for forms, applied
 * here to a read-only table.
 */
import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import type { ListingListItem, MetaField } from '@dse/shared';
import { ApiError } from '../api/client.js';
import { useListing, useMetaCategories } from '../api/queries.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { AllocationBar } from '../components/AllocationBar.js';
import { Button } from '../components/Button.js';
import { CategoryPlaceholder } from '../components/CategoryPlaceholder.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { StatusChip } from '../components/StatusChip.js';
import { QuantityStepper } from '../components/QuantityStepper.js';
import { formatDate, formatQuantity } from '../lib/format.js';

const NOT_RESERVABLE_STATUSES = new Set(['EXPIRED', 'WITHDRAWN', 'FULLY_RESERVED', 'COMPLETED']);

function formatAttributeValue(field: MetaField, value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <Skeleton variant="text" className="h-8 w-72" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr_320px]">
        <Skeleton variant="card" className="h-64" />
        <div className="flex flex-col gap-4">
          <Skeleton variant="text" className="h-6 w-2/3" />
          <Skeleton variant="text" className="h-4 w-1/2" />
          <Skeleton variant="card" className="h-56" />
        </div>
        <Skeleton variant="card" className="h-80" />
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        Listing not available
      </h1>
      <div className="mt-6">{children}</div>
    </div>
  );
}

/** Own listing (acting business = supplier) - no Matches/Withdraw, both cut (docs/04 § 2). */
function OwnListingBox(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-white p-5 shadow-card">
      <p className="text-[15px] font-semibold text-ink-900">This is your listing</p>
      <Link to="/dashboard" className="text-[14px] font-semibold text-brand-600 hover:underline">
        Go to my dashboard
      </Link>
    </div>
  );
}

function NotReservableBox({ listing }: { listing: ListingListItem }): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-white p-5 shadow-card">
      <StatusChip kind="listingStatus" status={listing.status} />
      <p className="text-[15px] text-ink-900">This listing is no longer accepting reservations.</p>
      <Button variant="secondary" onClick={() => navigate(`/browse?category=${listing.category}`)}>
        Browse similar surplus
      </Button>
    </div>
  );
}

/** Hooks here only mount once real listing data exists, so a default qty can be computed synchronously. */
function ListingReserveBox({ listing }: { listing: ListingListItem }): React.JSX.Element {
  const navigate = useNavigate();
  const step = listing.unit === 'KG' ? 0.5 : 1;
  const [quantity, setQuantity] = useState(Math.max(step, Math.min(listing.availableQuantity, 50)));

  function handleReserve(): void {
    navigate(`/reserve?listingId=${listing.listingId}&qty=${quantity}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-white p-5 shadow-card lg:sticky lg:top-6">
      <div>
        <p className="text-[15px] font-semibold text-ink-900">
          {formatQuantity(listing.availableQuantity, listing.unit)} available
        </p>
        <p className="text-[13px] text-ink-600">of {formatQuantity(listing.totalQuantity, listing.unit)} listed</p>
      </div>
      <div>
        <span className="text-[13px] font-semibold text-ink-700">Reserve quantity</span>
        <div className="mt-1.5">
          <QuantityStepper
            value={quantity}
            min={step}
            max={listing.availableQuantity}
            step={step}
            unit={listing.unit}
            onChange={setQuantity}
          />
        </div>
      </div>
      <Button
        variant="primary"
        fullWidth
        disabled={quantity <= 0 || quantity > listing.availableQuantity}
        onClick={handleReserve}
      >
        Reserve {formatQuantity(quantity, listing.unit)}
      </Button>
      <p className="text-[13px] text-ink-600">Held 48 h for you to collect. No payment is processed here.</p>
    </div>
  );
}

export function ListingDetailPage(): React.JSX.Element {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const listingQuery = useListing(listingId);
  const metaQuery = useMetaCategories();
  const acting = useActingBusiness();

  if (listingQuery.isPending || metaQuery.isPending) return <PageSkeleton />;

  if (listingQuery.isError) {
    const error = listingQuery.error;
    if (error instanceof ApiError && error.code === 'LISTING_NOT_FOUND') {
      return (
        <PageShell>
          <ErrorState message="This listing no longer exists." code={error.code} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate('/browse')}>
              Browse listings
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Go to home
            </Button>
          </div>
        </PageShell>
      );
    }
    return (
      <PageShell>
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Cannot reach the exchange. Try again.'}
          code={error instanceof ApiError ? error.code : undefined}
          onRetry={() => void listingQuery.refetch()}
        />
      </PageShell>
    );
  }

  if (metaQuery.isError) {
    return (
      <PageShell>
        <ErrorState
          message={
            metaQuery.error instanceof ApiError ? metaQuery.error.message : 'Cannot reach the exchange. Try again.'
          }
          onRetry={() => void metaQuery.refetch()}
        />
      </PageShell>
    );
  }

  const listing = listingQuery.data;
  const categoryMeta = metaQuery.data.items.find((category) => category.code === listing.category);
  const attributeFields = categoryMeta?.attributeFields ?? [];
  const attributeValues = listing.attributes as unknown as Record<string, unknown>;

  const isOwnListing = acting.status === 'ready' && acting.business.businessId === listing.businessId;
  const isReservable = !NOT_RESERVABLE_STATUSES.has(listing.status);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        {listing.title}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr_320px]">
        <CategoryPlaceholder category={listing.category} className="w-full" />

        <div className="flex flex-col gap-5">
          <div>
            <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-ink-600">
              <span>{listing.businessName}</span>
              <span aria-hidden="true">·</span>
              <span>{listing.area}</span>
              {!isOwnListing && listing.distanceKm !== undefined && listing.distanceKm !== 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  <span>{listing.distanceKm} km</span>
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip kind="condition" status={listing.condition} />
              <span className="inline-flex items-center gap-1 text-[13px] text-ink-600">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Available until {formatDate(listing.availableUntil)}
              </span>
            </div>
          </div>

          {attributeFields.length > 0 && (
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">
                Material details
              </h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
                {attributeFields.map((field) => (
                  <Fragment key={field.key}>
                    <dt className="text-ink-600">{field.label}</dt>
                    <dd className="text-ink-900">{formatAttributeValue(field, attributeValues[field.key])}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          )}

          {listing.description && (
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Description</h2>
              <p className="mt-2 text-[15px] text-ink-900">{listing.description}</p>
            </div>
          )}

          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Allocation</h2>
            <div className="mt-2 max-w-sm">
              <AllocationBar
                available={listing.availableQuantity}
                reserved={listing.reservedQuantity}
                handedOff={listing.handedOffQuantity}
                unit={listing.unit}
              />
            </div>
          </div>
        </div>

        {isOwnListing ? (
          <OwnListingBox />
        ) : isReservable ? (
          <ListingReserveBox listing={listing} />
        ) : (
          <NotReservableBox listing={listing} />
        )}
      </div>
    </div>
  );
}
