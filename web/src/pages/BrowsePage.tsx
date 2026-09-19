/**
 * S2 - Browse (docs/06-UI-SPEC.md § 5). Filter rail left, result grid right.
 *
 * The URL is the state (§ 5): every filter is a query param, so a filtered
 * view is shareable and the back button works. Filters are AND-combined; a
 * repeated param is OR-combined within itself, matching docs/04 § 3.
 *
 * Sort offers RECENT and DISTANCE_ASC only - the two the API implements.
 * Offering EXPIRING_SOON here would silently fall back to the default and look
 * like a bug.
 */
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { CONDITIONS, MATERIAL_CATEGORIES, label } from '@dse/shared';
import type { Condition, ListingsQuery, MaterialCategory } from '@dse/shared';
import { useListings } from '../api/queries.js';
import { ListingCard } from '../components/ListingCard.js';
import { Button } from '../components/Button.js';
import { Chip } from '../components/Chip.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { PackageSearch } from 'lucide-react';

const SORTS = [
  { value: 'RECENT', text: 'Recently listed' },
  { value: 'DISTANCE_ASC', text: 'Nearest first' },
] as const;

export function BrowsePage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();

  const categories = params.getAll('category').filter((c): c is MaterialCategory =>
    (MATERIAL_CATEGORIES as readonly string[]).includes(c),
  );
  const conditions = params.getAll('condition').filter((c): c is Condition =>
    (CONDITIONS as readonly string[]).includes(c),
  );
  const q = params.get('q') ?? '';
  const sort = params.get('sort') === 'DISTANCE_ASC' ? 'DISTANCE_ASC' : 'RECENT';

  const query: ListingsQuery = {
    limit: 24,
    sort,
    ...(categories.length ? { category: categories } : {}),
    ...(conditions.length ? { condition: conditions } : {}),
    ...(q ? { q } : {}),
  };
  const listingsQuery = useListings(query);

  /** Every mutation goes through the URL so back/forward and sharing work. */
  function toggle(key: 'category' | 'condition', value: string): void {
    const next = new URLSearchParams(params);
    const current = next.getAll(key);
    next.delete(key);
    for (const v of current) if (v !== value) next.append(key, v);
    if (!current.includes(value)) next.append(key, value);
    setParams(next);
  }

  function setSort(value: string): void {
    const next = new URLSearchParams(params);
    next.set('sort', value);
    setParams(next);
  }

  const activeFilters = [
    ...categories.map((c) => ({ key: 'category' as const, value: c, text: label('category', c) ?? c })),
    ...conditions.map((c) => ({ key: 'condition' as const, value: c, text: label('condition', c) ?? c })),
  ];

  const items = listingsQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
        Browse surplus
      </h1>
      <p className="mt-1 text-[15px] text-ink-600">
        {listingsQuery.isPending
          ? 'Loading…'
          : `${items.length} listing${items.length === 1 ? '' : 's'}${q ? ` matching “${q}”` : ''}`}
      </p>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* Filter rail */}
        <aside className="w-full shrink-0 lg:w-[280px]">
          <div className="rounded-lg border border-ink-200 bg-white p-4">
            <fieldset>
              <legend className="text-[14px] font-semibold text-ink-900">Category</legend>
              <div className="mt-2 flex flex-col gap-2">
                {MATERIAL_CATEGORIES.map((category) => (
                  <label key={category} className="flex items-center gap-2 text-[14px] text-ink-700">
                    <input
                      type="checkbox"
                      checked={categories.includes(category)}
                      onChange={() => toggle('category', category)}
                      className="h-4 w-4"
                    />
                    {label('category', category) ?? category}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-[14px] font-semibold text-ink-900">Condition</legend>
              <div className="mt-2 flex flex-col gap-2">
                {CONDITIONS.map((condition) => (
                  <label key={condition} className="flex items-center gap-2 text-[14px] text-ink-700">
                    <input
                      type="checkbox"
                      checked={conditions.includes(condition)}
                      onChange={() => toggle('condition', condition)}
                      className="h-4 w-4"
                    />
                    {label('condition', condition) ?? condition}
                  </label>
                ))}
              </div>
            </fieldset>

            {activeFilters.length > 0 && (
              <Button variant="ghost" className="mt-5" onClick={() => setParams(new URLSearchParams())}>
                Clear all
              </Button>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-brand-100 bg-brand-050 p-4">
            <p className="text-[14px] font-semibold text-ink-900">
              Tell us what you need and we will match it for you
            </p>
            <Link
              to="/requirements/new"
              className="mt-3 inline-block rounded-md bg-accent-500 px-4 py-2 text-[14px] font-semibold text-ink-900 hover:bg-accent-600"
            >
              Post a Requirement
            </Link>
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.map((filter) => (
                <button key={`${filter.key}-${filter.value}`} onClick={() => toggle(filter.key, filter.value)}>
                  <Chip variant="info">{filter.text} &times;</Chip>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[14px] text-ink-700">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-9 rounded-md border border-ink-300 bg-white px-2 text-[14px]"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.text}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            {listingsQuery.isPending ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="card" className="h-[380px]" />
                ))}
              </div>
            ) : listingsQuery.isError ? (
              <ErrorState
                message="Cannot load listings right now."
                onRetry={() => void listingsQuery.refetch()}
              />
            ) : items.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="No listings match these filters"
                body="Try removing a filter, or post a requirement and we will match it as surplus is listed."
                actions={[{ label: 'Clear all filters', onClick: () => setParams(new URLSearchParams()) }]}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((listing) => (
                  <ListingCard key={listing.listingId} listing={listing} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
