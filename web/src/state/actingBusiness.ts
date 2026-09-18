/**
 * Acting-business identity - docs/06-UI-SPEC.md § 3 "Business switcher",
 * the P0 identity mechanism (01-PRD.md § 8).
 * OWNER: M1.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { Business } from '@dse/shared';
import { ACTING_BUSINESS_ID_KEY, ApiError, getBusinesses } from '../api/client.js';

type Listener = () => void;

const listeners = new Set<Listener>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === ACTING_BUSINESS_ID_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(ACTING_BUSINESS_ID_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Pure - no localStorage, no React. Exported so the fallback/default logic
 * is easy to unit test later without mocking storage.
 */
export function resolveActingBusinessId(storedId: string | null, businesses: Business[]): string | null {
  if (storedId && businesses.some((business) => business.businessId === storedId)) return storedId;
  return businesses[0]?.businessId ?? null;
}

/**
 * Writes the resolved default id once, without resetting any cached
 * queries - only an explicit switch (setActingBusiness) invalidates the
 * cache. Idempotent: several components call useActingBusiness(), and
 * only the first to observe the mismatch should actually write.
 */
function persistDefaultActingBusiness(id: string): void {
  try {
    if (localStorage.getItem(ACTING_BUSINESS_ID_KEY) === id) return;
    localStorage.setItem(ACTING_BUSINESS_ID_KEY, id);
  } catch {
    return;
  }
  emitChange();
}

/**
 * Explicit switch (BusinessSwitcher). Writes storage first, then resets
 * every cached query except the ones keyed under 'businesses' / 'meta',
 * which do not vary by acting business. Stays on the current route.
 */
export function setActingBusiness(id: string, queryClient: QueryClient): void {
  try {
    localStorage.setItem(ACTING_BUSINESS_ID_KEY, id);
  } catch {
    return;
  }
  emitChange();
  void queryClient.resetQueries({
    predicate: (query) => {
      const [firstKey] = query.queryKey;
      return firstKey !== 'businesses' && firstKey !== 'meta';
    },
  });
}

export type ActingBusinessState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError | Error; retry: () => void }
  | { status: 'ready'; business: Business; businesses: Business[] };

/**
 * Combines the localStorage snapshot with GET /v1/businesses to resolve
 * who the acting business is.
 *
 * Stays 'loading' until the resolved id has actually been persisted AND
 * the localStorage snapshot reflects it - not just resolved in memory.
 * api/client.ts reads X-Business-Id from localStorage at request time, and
 * child effects commit before parent effects, so a naive "resolved in
 * this render -> ready" would let a child's first request fire before the
 * default was actually written.
 */
export function useActingBusiness(): ActingBusinessState {
  const storedId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const businessesQuery = useQuery({
    queryKey: ['businesses'],
    queryFn: getBusinesses,
  });

  const businesses = businessesQuery.data?.items ?? null;
  const resolvedId = businesses ? resolveActingBusinessId(storedId, businesses) : null;
  const isDefaultPending = resolvedId !== null && resolvedId !== storedId;

  useEffect(() => {
    if (isDefaultPending && resolvedId) {
      persistDefaultActingBusiness(resolvedId);
    }
  }, [isDefaultPending, resolvedId]);

  if (businessesQuery.isPending) return { status: 'loading' };

  if (businessesQuery.isError) {
    return {
      status: 'error',
      error: businessesQuery.error as ApiError | Error,
      retry: () => void businessesQuery.refetch(),
    };
  }

  if (!businesses || businesses.length === 0) {
    return {
      status: 'error',
      error: new Error('No businesses available.'),
      retry: () => void businessesQuery.refetch(),
    };
  }

  if (!resolvedId || isDefaultPending) {
    return { status: 'loading' };
  }

  const business = businesses.find((candidate) => candidate.businessId === resolvedId);
  if (!business) return { status: 'loading' };

  return { status: 'ready', business, businesses };
}
