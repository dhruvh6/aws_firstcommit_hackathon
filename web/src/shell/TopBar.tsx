/**
 * TopBar - docs/06-UI-SPEC.md § 3. Sticky brand-blue bar: wordmark, global
 * search, acting-business identity, and the one primary action per screen.
 *
 * Below 640px this is three stacked rows (docs/06 § 14): wordmark + CTA,
 * then search, then the business switcher - the switcher select takes the
 * remaining row width and truncates instead of forcing a fixed width,
 * which is what overflowed the viewport at 390px. From 640px up it is the
 * original single-row-at->=768px layout, unchanged.
 * OWNER: M1.
 */
import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '../components/Button.js';
import { BusinessSwitcher } from './BusinessSwitcher.js';

interface SearchFormProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
}

function SearchForm({ query, onQueryChange, onSubmit, className }: SearchFormProps): React.JSX.Element {
  const inputId = useId();

  return (
    <form onSubmit={onSubmit} className={className}>
      <label htmlFor={inputId} className="sr-only">
        Search surplus material
      </label>
      <div className="flex h-9 w-full items-center rounded-md border border-brand-500 bg-white px-3">
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search surplus material"
          className="w-full min-w-0 bg-transparent text-[14px] text-ink-900 placeholder:text-ink-500 focus:outline-none"
        />
        <button type="submit" aria-label="Search" className="ml-2 shrink-0 text-ink-600 hover:text-ink-900">
          <Search className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

export function TopBar(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (location.pathname === '/browse') {
      setQuery(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.pathname, location.search]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : '/browse');
  }

  return (
    <div className="sticky top-0 z-30 bg-brand-700">
      {/* < 640px: wordmark+CTA / search / switcher, each its own row. */}
      <div className="mx-auto flex max-w-[1280px] flex-col gap-2 px-6 py-2 sm:hidden">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Link to="/" className="shrink-0 truncate text-lg font-bold text-white">
            DeadStock Exchange
          </Link>
          <Link to="/listings/new" className="shrink-0">
            <Button variant="primary" size="sm">
              + List surplus
            </Button>
          </Link>
        </div>

        <SearchForm query={query} onQueryChange={setQuery} onSubmit={handleSubmit} />

        <BusinessSwitcher fullWidth />
      </div>

      {/* >= 640px: single row from 768px up; search wraps to its own row 640-767px. */}
      <div className="mx-auto hidden max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2 sm:flex md:h-14 md:flex-nowrap md:py-0">
        <Link to="/" className="order-1 shrink-0 text-lg font-bold text-white md:order-none">
          DeadStock Exchange
        </Link>

        <SearchForm
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          className="order-3 min-w-0 basis-full md:order-none md:min-w-[200px] md:basis-0 md:flex-1"
        />

        <div className="order-2 ml-auto flex shrink-0 items-center gap-4 md:order-none">
          <BusinessSwitcher />
          <Link to="/listings/new">
            <Button variant="primary" size="sm">
              + List surplus
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
