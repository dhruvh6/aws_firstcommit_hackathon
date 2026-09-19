/**
 * S1 - Home (docs/06-UI-SPEC.md § 4).
 *
 * A mainstream marketplace landing page - hero search, category tiles, three
 * rails, how-it-works, impact strip - because buyers already know how to
 * operate one (docs/06 § 1). The exchange semantics stay underneath: the dual
 * hero CTA is load-bearing, since it is how a visitor learns in two seconds
 * that this is two-sided rather than a shop.
 *
 * No commerce theatre (docs/06 § 1): no prices in the hero, no discount
 * badges, no fake urgency, no ratings, no cart.
 *
 * Rails: "expiring soon" is sorted client-side because the API implements
 * RECENT and DISTANCE_ASC only; at rail size (8 rows) that is exact, and it
 * avoids inventing a server sort the contract does not have.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { MATERIAL_CATEGORIES, label } from '@dse/shared';
import type { MaterialCategory, SurplusListing } from '@dse/shared';
import { useImpact, useListings } from '../api/queries.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { ListingCard } from '../components/ListingCard.js';
import { Button } from '../components/Button.js';
import { Skeleton } from '../components/Skeleton.js';
import { categoryIcon } from '../lib/categoryIcon.js';
import { formatQuantity } from '../lib/format.js';

const CATEGORY_SLUG: Record<MaterialCategory, string> = {
  WOOD_OFFCUTS: 'wood',
  FABRIC_OFFCUTS: 'fabric',
  PACKAGING_CARDBOARD: 'packaging',
  ACRYLIC_SHEET: 'acrylic',
};

const STEPS = [
  'List surplus',
  'Post a requirement',
  'See why it matches',
  'Reserve what you need',
  'Confirm handoff',
  'Impact recorded',
];

function RailSkeleton(): React.JSX.Element {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} variant="card" className="h-[380px] w-[276px] shrink-0" />
      ))}
    </div>
  );
}

function Rail({
  title,
  subtitle,
  listings,
  isPending,
  seeAllHref,
}: {
  title: string;
  subtitle?: string;
  listings: SurplusListing[];
  isPending: boolean;
  seeAllHref: string;
}): React.JSX.Element | null {
  if (!isPending && listings.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[14px] text-ink-600">{subtitle}</p>}
        </div>
        <Link
          to={seeAllHref}
          className="flex shrink-0 items-center gap-1 text-[14px] font-medium text-brand-600 hover:underline"
        >
          See all <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4">
        {isPending ? (
          <RailSkeleton />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {listings.map((listing) => (
              <ListingCard key={listing.listingId} listing={listing} fixedWidth />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function HomePage(): React.JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const acting = useActingBusiness();
  const actingReady = acting.status === 'ready';

  const recentQuery = useListings({ sort: 'RECENT', limit: 8 });
  /**
   * DISTANCE_ASC needs an origin: the API returns 400 VALIDATION_FAILED
   * without X-Business-Id. Gate it on the acting business resolving, or the
   * rail silently disappears on a cold first load - verified against the API,
   * not assumed.
   */
  const nearestQuery = useListings({ sort: 'DISTANCE_ASC', limit: 8 }, { enabled: actingReady });
  const impactQuery = useImpact();

  const recent = useMemo(() => recentQuery.data?.items ?? [], [recentQuery.data]);

  /** Soonest-expiring first. Client-side: the API has no EXPIRING_SOON sort. */
  const expiring = useMemo(
    () => [...recent].sort((a, b) => a.availableUntil.localeCompare(b.availableUntil)).slice(0, 8),
    [recent],
  );

  const activeByCategory = useMemo(() => {
    const map = new Map<string, { quantity: number; unit: string }>();
    for (const row of impactQuery.data?.byCategory ?? []) {
      map.set(row.category, { quantity: row.activeSurplus, unit: row.unit });
    }
    return map;
  }, [impactQuery.data]);

  const totals = impactQuery.data?.totals;
  const reusedKg = totals?.quantityReusedByUnit.KG ?? 0;

  function onSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : '/browse');
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-700 to-brand-600 px-6 py-14 text-white">
        <div className="mx-auto max-w-[1280px]">
          <h1 tabIndex={-1} className="max-w-3xl text-[34px] font-bold leading-[42px]">
            Turn surplus material into someone else&rsquo;s raw material
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] text-brand-100">
            Wood, fabric, packaging and acrylic surplus from businesses near you &mdash; listed with
            real quantities, dimensions and condition, not a photo and a phone number.
          </p>

          <form onSubmit={onSearch} className="mt-6 flex max-w-2xl gap-2">
            <label htmlFor="home-search" className="sr-only">
              What material do you need?
            </label>
            <input
              id="home-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What material do you need?"
              className="h-11 min-w-0 flex-1 rounded-md border border-transparent bg-white px-4 text-[15px] text-ink-900 placeholder:text-ink-500"
            />
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-md bg-accent-500 px-5 text-[15px] font-semibold text-ink-900 hover:bg-accent-600"
            >
              <Search className="h-4 w-4" aria-hidden="true" /> Search
            </button>
          </form>

          {/* Load-bearing: this is how a visitor learns the exchange is two-sided. */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/listings/new"
              className="rounded-md bg-white px-5 py-2.5 text-[15px] font-semibold text-brand-700 hover:bg-brand-050"
            >
              I have surplus &rarr; List Surplus
            </Link>
            <Link
              to="/requirements/new"
              className="rounded-md border border-white/60 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-white/10"
            >
              I need material &rarr; Post a Requirement
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-6 pb-16">
        {/* Category tiles */}
        <section className="mt-10">
          <h2 className="text-[20px] font-semibold text-ink-900">Browse by material</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {MATERIAL_CATEGORIES.map((category) => {
              const Icon = categoryIcon(CATEGORY_SLUG[category]);
              const active = activeByCategory.get(category);
              return (
                <Link
                  key={category}
                  to={`/browse?category=${category}`}
                  className="flex flex-col items-start gap-2 rounded-lg border border-ink-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-hover"
                >
                  <Icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
                  <span className="text-[15px] font-semibold text-ink-900">
                    {label('category', category) ?? category}
                  </span>
                  <span className="text-[13px] text-ink-600">
                    {impactQuery.isPending
                      ? '—'
                      : active && active.quantity > 0
                        ? `${formatQuantity(active.quantity, active.unit)} available`
                        : 'Nothing listed yet'}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <Rail
          title="Expiring soon"
          subtitle="Use it before it is lost"
          listings={expiring}
          isPending={recentQuery.isPending}
          seeAllHref="/browse?sort=RECENT"
        />
        <Rail
          title="Nearest to you"
          listings={nearestQuery.data?.items ?? []}
          isPending={!actingReady || nearestQuery.isPending}
          seeAllHref="/browse?sort=DISTANCE_ASC"
        />
        <Rail
          title="Recently listed"
          listings={recent}
          isPending={recentQuery.isPending}
          seeAllHref="/browse?sort=RECENT"
        />

        {/* How it works */}
        <section className="mt-12 rounded-lg border border-ink-200 bg-white p-6">
          <h2 className="text-[20px] font-semibold text-ink-900">How it works</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-050 text-[13px] font-semibold text-brand-700">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-[15px] text-ink-700">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Impact strip - every figure traces to an ImpactRecord (docs/04 § 3). */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-lg bg-ink-900 px-6 py-5 text-white">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <p className="text-[24px] font-bold">{formatQuantity(reusedKg, 'KG')}</p>
              <p className="text-[13px] text-ink-300">material reused</p>
            </div>
            <div>
              <p className="text-[24px] font-bold">{totals?.completedExchanges ?? 0}</p>
              <p className="text-[13px] text-ink-300">completed exchanges</p>
            </div>
            <div>
              <p className="text-[24px] font-bold">{totals?.requirementsOpen ?? 0}</p>
              <p className="text-[13px] text-ink-300">open requirements</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate('/impact')}>
            See impact
          </Button>
        </section>
      </div>
    </div>
  );
}
