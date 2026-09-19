/**
 * ListingCard - docs/07-DESIGN-SYSTEM.md § 4. The most-reused card in the app:
 * the browse grid (docs/06 § 5) and every home rail (§ 4) render from it.
 *
 * Contents top to bottom, per the spec: category placeholder (4:3), title
 * clamped to two lines, available quantity in semibold, condition chip, the
 * one or two headline attributes for the category, distance with a pin when an
 * origin resolved, availability with an amber clock at <= 2 days, supplier
 * name, and a Reserve action. A partially-reserved listing also shows the
 * allocation split.
 */
import { Link, useNavigate } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import type { SurplusListing } from '@dse/shared';
import { label } from '@dse/shared';
import { CategoryPlaceholder } from './CategoryPlaceholder.js';
import { AllocationBar } from './AllocationBar.js';
import { Button } from './Button.js';
import { Chip } from './Chip.js';
import { formatDate, formatQuantity } from '../lib/format.js';

export interface ListingCardProps {
  listing: SurplusListing & { distanceKm?: number };
  /** Rails scroll horizontally and need a fixed width; the grid stretches. */
  fixedWidth?: boolean;
  className?: string;
}

const DAY_MS = 86_400_000;

/** Days from today to an ISO date, UTC-anchored so a DST edge cannot shift it. */
function daysUntil(iso: string): number {
  const then = Date.parse(`${iso}T00:00:00.000Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.round((then - today) / DAY_MS);
}

/**
 * The one or two facts that actually help someone judge a lot at a glance.
 * Attribute shapes are per-category (docs/02 § 8), so this reads defensively
 * rather than assuming any key exists.
 */
function headlineAttributes(listing: SurplusListing): string | null {
  const a = listing.attributes as Record<string, unknown>;
  const num = (k: string): number | undefined => (typeof a[k] === 'number' ? (a[k] as number) : undefined);

  switch (listing.category) {
    case 'WOOD_OFFCUTS': {
      const min = num('minPieceSizeCm');
      const max = num('maxPieceSizeCm');
      const size = min !== undefined && max !== undefined ? `${min}–${max} cm` : null;
      const treated = a.treated === false ? 'untreated' : a.treated === true ? 'treated' : null;
      return [size, treated].filter(Boolean).join(' · ') || null;
    }
    case 'FABRIC_OFFCUTS': {
      const min = num('minPieceLengthCm');
      const max = num('maxPieceLengthCm');
      const len = min !== undefined && max !== undefined ? `${min}–${max} cm` : null;
      const gsm = num('gsm');
      return [len, gsm ? `${gsm} gsm` : null].filter(Boolean).join(' · ') || null;
    }
    case 'PACKAGING_CARDBOARD': {
      const ply = num('ply');
      const printed = a.printed === true ? 'printed' : a.printed === false ? 'unprinted' : null;
      return [ply ? `${ply}-ply` : null, printed].filter(Boolean).join(' · ') || null;
    }
    case 'ACRYLIC_SHEET': {
      const thickness = num('thicknessMm');
      const min = num('minSheetSizeCm');
      const max = num('maxSheetSizeCm');
      const size = min !== undefined && max !== undefined ? `${min}–${max} cm` : null;
      return [thickness ? `${thickness} mm` : null, size].filter(Boolean).join(' · ') || null;
    }
    default:
      return null;
  }
}

export function ListingCard({ listing, fixedWidth = false, className = '' }: ListingCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const days = daysUntil(listing.availableUntil);
  const expiringSoon = days <= 2;
  const partlyReserved = listing.reservedQuantity > 0 || listing.handedOffQuantity > 0;
  const reservable = listing.status === 'ACTIVE' || listing.status === 'PARTIALLY_RESERVED';
  const attributes = headlineAttributes(listing);
  const conditionLabel = label('condition', listing.condition) ?? listing.condition;

  // Default the stepper to something sensible rather than the whole lot.
  const suggested = Math.min(listing.availableQuantity, 50);

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-hover ${fixedWidth ? 'w-[276px] shrink-0' : ''} ${className}`}
    >
      <Link to={`/listings/${listing.listingId}`} className="block">
        <CategoryPlaceholder category={listing.category} className="aspect-[4/3] w-full" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={`/listings/${listing.listingId}`} className="block">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-[22px] text-ink-900">{listing.title}</h3>
        </Link>

        <p className="text-[15px] font-semibold text-ink-900">
          {formatQuantity(listing.availableQuantity, listing.unit)} available
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip variant="neutral">{conditionLabel}</Chip>
          {attributes && <span className="text-[13px] text-ink-600">{attributes}</span>}
        </div>

        {partlyReserved && (
          <AllocationBar
            available={listing.availableQuantity}
            reserved={listing.reservedQuantity}
            handedOff={listing.handedOffQuantity}
            unit={listing.unit}
          />
        )}

        <dl className="mt-auto flex flex-col gap-1 pt-1 text-[13px] text-ink-600">
          {listing.distanceKm !== undefined && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{listing.distanceKm} km away</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 ${expiringSoon ? 'text-warn-700' : ''}`}>
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Available until {formatDate(listing.availableUntil)}
              {expiringSoon && days >= 0 ? (days === 0 ? ' · today' : days === 1 ? ' · tomorrow' : ` · ${days} days`) : ''}
            </span>
          </div>
          <div className="truncate">{listing.businessName}</div>
        </dl>

        {reservable ? (
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate(`/reserve?listingId=${listing.listingId}&qty=${suggested}`)}
          >
            Reserve
          </Button>
        ) : (
          <p className="text-[13px] text-ink-600">{label('listingStatus', listing.status) ?? listing.status}</p>
        )}
      </div>
    </article>
  );
}
