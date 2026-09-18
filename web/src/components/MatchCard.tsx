/**
 * MatchCard - docs/07-DESIGN-SYSTEM.md § 4 component table; layout and
 * copy per docs/06 § 9 (the WOW screen). OWNER: M1.
 *
 * Two variants, driven by `match.compatible` (docs/03 § 2:
 * `compatible === checks.every(c => c.passed)`), never re-derived here:
 *   - compatible: large, brand border, category placeholder, reserve box.
 *   - near-miss: grey border, de-emphasised, no photo, no reserve box.
 * `score` is never read or rendered (docs/03 § 6, docs/06 § 9 non-negotiable #4).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import type { Match } from '@dse/shared';
import { CategoryPlaceholder } from './CategoryPlaceholder.js';
import { CheckList } from './CheckList.js';
import { Chip } from './Chip.js';
import { StatusChip } from './StatusChip.js';
import { QuantityStepper } from './QuantityStepper.js';
import { Button } from './Button.js';
import { formatDate, formatQuantity } from '../lib/format.js';

export interface MatchCardProps {
  match: Match;
  requirementId: string;
  /** Current remaining requirement quantity, used to cap the reserve stepper. */
  remainingRequirement: number;
  /** Entrance-animation slot, 0-based - capped at 2 so only the first three cards stagger. */
  animationIndex?: number;
  className?: string;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function MatchCard({
  match,
  requirementId,
  remainingRequirement,
  animationIndex,
  className,
}: MatchCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const { listing } = match;
  const step = listing.unit === 'KG' ? 0.5 : 1;
  const max = Math.max(0, round2(Math.min(listing.availableQuantity, remainingRequirement)));
  const defaultQty = Math.max(step, round2(Math.min(match.compatibleQuantity, max)));
  const [quantity, setQuantity] = useState(defaultQty);

  const animationStyle =
    animationIndex === undefined
      ? undefined
      : { animationDelay: `${Math.min(animationIndex, 2) * 120}ms` };

  function handleReserve(): void {
    const params = new URLSearchParams({
      listingId: listing.listingId,
      requirementId,
      qty: String(quantity),
    });
    navigate(`/reserve?${params.toString()}`);
  }

  if (!match.compatible) {
    return (
      <div
        style={animationStyle}
        className={`motion-safe:animate-[match-card-in_160ms_ease-out_backwards] motion-reduce:animate-none rounded-lg border border-ink-300 bg-ink-050 p-4 ${className ?? ''}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-ink-700">{listing.title}</h3>
            <p className="text-[13px] text-ink-600">
              {listing.businessName} · {listing.area} · {match.distanceKm} km
            </p>
          </div>
          <Chip variant="neutral">Not compatible</Chip>
        </div>
        <div className="mt-3">
          <CheckList checks={match.checks} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={animationStyle}
      className={`motion-safe:animate-[match-card-in_160ms_ease-out_backwards] motion-reduce:animate-none rounded-lg border-2 border-brand-600 bg-white p-4 shadow-card ${className ?? ''}`}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_280px]">
        <CategoryPlaceholder category={listing.category} className="w-full" />

        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink-900">{listing.title}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[13px] text-ink-600">
              <span>{listing.businessName}</span>
              <span aria-hidden="true">·</span>
              <span>{listing.area}</span>
              <span aria-hidden="true">·</span>
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              <span>{match.distanceKm} km</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-ink-900">
              <span className="font-semibold">{formatQuantity(listing.availableQuantity, listing.unit)} available</span>
              <StatusChip kind="condition" status={listing.condition} />
              <span className="inline-flex items-center gap-1 text-ink-600">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                until {formatDate(listing.availableUntil)}
              </span>
            </p>
          </div>

          <div>
            <h4 className="text-[13px] font-semibold uppercase tracking-[0.02em] text-ink-700">Why this matches</h4>
            <div className="mt-2">
              <CheckList checks={match.checks} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-ink-050 p-4">
          <span className="text-[13px] font-semibold text-ink-700">Reserve</span>
          <QuantityStepper
            value={quantity}
            min={step}
            max={max}
            step={step}
            unit={listing.unit}
            onChange={setQuantity}
          />
          <Button
            variant="primary"
            fullWidth
            disabled={quantity <= 0 || quantity > max}
            onClick={handleReserve}
          >
            Reserve {formatQuantity(quantity, listing.unit)}
          </Button>
        </div>
      </div>
    </div>
  );
}
