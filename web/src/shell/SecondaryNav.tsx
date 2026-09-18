/**
 * SecondaryNav - docs/06-UI-SPEC.md § 3. Category shortcut + the five
 * primary destinations, with the reservations-awaiting-handoff badge (the
 * "you owe someone a handoff" signal).
 * OWNER: M1.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { label, MATERIAL_CATEGORIES } from '@dse/shared';
import { getReservations } from '../api/client.js';
import { useActingBusiness } from '../state/actingBusiness.js';

const CATEGORY_LINKS = MATERIAL_CATEGORIES.map((code) => ({
  code,
  label: label('category', code) ?? code,
}));

interface NavItem {
  text: string;
  to: string;
  isActive: (pathname: string, search: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { text: 'Browse', to: '/browse', isActive: (pathname) => pathname === '/browse' },
  {
    text: 'Post a requirement',
    to: '/requirements/new',
    isActive: (pathname) => pathname === '/requirements/new',
  },
  {
    text: 'My dashboard',
    to: '/dashboard',
    isActive: (pathname, search) =>
      pathname === '/dashboard' && new URLSearchParams(search).get('tab') !== 'reservations',
  },
  {
    text: 'Reservations',
    to: '/dashboard?tab=reservations',
    isActive: (pathname, search) =>
      pathname === '/dashboard' && new URLSearchParams(search).get('tab') === 'reservations',
  },
  { text: 'Impact', to: '/impact', isActive: (pathname) => pathname === '/impact' },
];

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function CategoryDropdown(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 items-center gap-1 whitespace-nowrap px-3 text-[14px] font-medium text-ink-700 hover:bg-ink-050"
      >
        All materials
        <ChevronDown className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute left-0 top-full z-20 w-56 rounded-md border border-ink-200 bg-white py-1 shadow-hover"
        >
          {CATEGORY_LINKS.map((category) => (
            <Link
              key={category.code}
              to={`/browse?category=${category.code}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[14px] text-ink-900 hover:bg-ink-050"
            >
              {category.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SecondaryNav(): React.JSX.Element {
  const location = useLocation();
  const acting = useActingBusiness();
  const businessId = acting.status === 'ready' ? acting.business.businessId : null;

  const badgeQuery = useQuery({
    queryKey: ['reservations', 'badge', businessId],
    queryFn: () => getReservations({ role: 'SUPPLIER', status: ['RESERVED'] }),
    enabled: acting.status === 'ready',
  });

  const showBadge = (badgeQuery.data?.meta.count ?? 0) > 0;
  const badgeCount = badgeQuery.data?.meta.nextCursor
    ? '24+'
    : String(badgeQuery.data?.meta.count ?? 0);

  return (
    <nav aria-label="Primary" className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center gap-1 px-6">
        <CategoryDropdown />
        {/* Only the destination links scroll horizontally - the dropdown
            trigger+menu stay outside this scroll container so the menu
            (absolutely positioned) never gets clipped by it. */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="flex items-center gap-1 whitespace-nowrap">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(location.pathname, location.search);
              return (
                <Link
                  key={item.text}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex h-10 items-center gap-1.5 border-b-2 px-3 text-[14px] font-medium',
                    active
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-ink-700 hover:bg-ink-050',
                  )}
                >
                  {item.text}
                  {item.text === 'Reservations' && showBadge && (
                    <span
                      aria-label={
                        badgeCount === '24+'
                          ? 'More than 24 reservations awaiting handoff'
                          : `${badgeCount} reservation${badgeCount === '1' ? '' : 's'} awaiting handoff`
                      }
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-warn-050 px-1.5 text-[11px] font-semibold text-warn-700"
                    >
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
