/**
 * S1 - Home (docs/06-UI-SPEC.md § 4). OWNER: M1.
 *
 * Minimal pass: the three listing rails are skipped - they render
 * `ListingCard`, which does not exist yet (docs/06 § 2 build order puts S1
 * last, after S2/S3). Category-tile counts and the impact strip both come
 * from `GET /v1/impact` (`scope: 'PLATFORM'`, no acting business needed),
 * shared with S10 via the same `useImpact` hook.
 */
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useImpact, useMetaCategories } from '../api/queries.js';
import { ApiError } from '../api/client.js';
import { Button } from '../components/Button.js';
import { ErrorState } from '../components/ErrorState.js';
import { Input } from '../components/Input.js';
import { Skeleton } from '../components/Skeleton.js';
import { categoryIcon } from '../lib/categoryIcon.js';
import { formatQuantity } from '../lib/format.js';

const HOW_IT_WORKS = [
  'List surplus',
  'Post a requirement',
  'See why it matches',
  'Reserve what you need',
  'Confirm handoff',
  'Impact recorded',
];

function PageSkeleton(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <Skeleton variant="card" className="h-64" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton variant="tile" className="h-24 w-full" />
        <Skeleton variant="tile" className="h-24 w-full" />
        <Skeleton variant="tile" className="h-24 w-full" />
        <Skeleton variant="tile" className="h-24 w-full" />
      </div>
    </div>
  );
}

export function HomePage(): React.JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const metaQuery = useMetaCategories();
  const impactQuery = useImpact({ scope: 'PLATFORM' }, null);

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : '/browse');
  }

  if (metaQuery.isPending) return <PageSkeleton />;

  if (metaQuery.isError) {
    return (
      <div className="mx-auto max-w-[1280px] px-6 py-10">
        <h1 tabIndex={-1} className="text-2xl font-bold text-ink-900">
          Home
        </h1>
        <div className="mt-6">
          <ErrorState
            message={
              metaQuery.error instanceof ApiError ? metaQuery.error.message : 'Cannot reach the exchange. Try again.'
            }
            onRetry={() => void metaQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const byCategory = impactQuery.data?.byCategory ?? [];
  const totals = impactQuery.data?.totals;

  return (
    <div>
      <section className="bg-[linear-gradient(135deg,var(--brand-700),var(--brand-600))] px-6 py-16 text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start gap-6">
          <h1 tabIndex={-1} className="max-w-2xl text-[44px] font-bold leading-[52px]">
            Turn surplus material into someone else&apos;s raw material
          </h1>
          <p className="max-w-xl text-[15px] text-brand-100">
            Wood, fabric, packaging and acrylic surplus from businesses near you
          </p>
          <form onSubmit={handleSearch} className="flex w-full max-w-xl items-end gap-3">
            <Input
              label="Search surplus material"
              placeholder="What material do you need?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="flex-1 [&_label]:sr-only"
            />
            <Button type="submit" variant="secondary" className="border-white bg-white text-brand-700 hover:bg-brand-050">
              <Search className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Search
            </Button>
          </form>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate('/listings/new')}>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[12px] font-normal opacity-80">I have surplus</span>
                <span>List surplus material</span>
              </span>
            </Button>
            <Button
              variant="secondary"
              className="border-white! bg-transparent! text-white! hover:bg-white/10!"
              onClick={() => navigate('/requirements/new')}
            >
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[12px] font-normal opacity-80">I need material</span>
                <span>Post a requirement</span>
              </span>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metaQuery.data.items.map((category) => {
            const stats = byCategory.find((entry) => entry.category === category.code);
            const quantity = stats?.activeSurplus ?? 0;
            const unit = stats?.unit ?? category.canonicalUnit;
            const Icon = categoryIcon(category.icon);
            return (
              <Link
                key={category.code}
                to={`/browse?category=${category.code}`}
                className="flex flex-col items-center gap-2 rounded-lg border border-ink-200 bg-white p-5 text-center shadow-card hover:shadow-hover"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-050">
                  <Icon className="h-6 w-6 text-brand-600" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="text-[15px] font-semibold text-ink-900">{category.label}</span>
                <span className="text-[13px] text-ink-600">{formatQuantity(quantity, unit)} available</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-8">
        <h2 className="text-xl font-semibold text-ink-900">How it works</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-card">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-050 text-[13px] font-semibold text-brand-600">
                {index + 1}
              </span>
              <span className="text-[15px] text-ink-900">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {totals && (
        <section className="mx-auto max-w-[1280px] px-6 pb-10">
          <Link
            to="/impact"
            className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white px-6 py-5 text-center shadow-card hover:shadow-hover"
          >
            <span className="text-[15px] font-semibold text-ink-900">
              {formatQuantity(totals.quantityReusedByUnit.KG, 'KG')} reused
            </span>
            <span aria-hidden="true" className="text-ink-300">
              ·
            </span>
            <span className="text-[15px] font-semibold text-ink-900">
              {totals.completedExchanges} completed exchange{totals.completedExchanges === 1 ? '' : 's'}
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
