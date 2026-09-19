/**
 * TanStack Query hooks layered on api/client.ts. OWNER: M1.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type {
  HandoffResponse,
  ImpactQuery,
  ImpactResponse,
  ListingResponse,
  ListingsQuery,
  ListingsResponse,
  MetaCategoriesResponse,
  RequirementMatchesResponse,
  ReservationsQuery,
  ReservationsResponse,
} from '@dse/shared';
import { getImpact, getListing, getListings, getMetaCategories, getRequirementMatches, getReservations, handoffReservation } from './client.js';

/**
 * GET /v1/meta/categories - static taxonomy, fetched once and cached for
 * the life of the app (docs/04 § 3: "fetched once at app start and cached").
 */
export function useMetaCategories(): UseQueryResult<MetaCategoriesResponse> {
  return useQuery({
    queryKey: ['meta', 'categories'],
    queryFn: getMetaCategories,
    staleTime: Infinity,
  });
}

/**
 * GET /v1/requirements/{requirementId}/matches - the S6 query key. S5's
 * submit handler (RequirementNewPage.tsx) primes this exact key via
 * `queryClient.setQueryData` from the `POST /v1/requirements?withMatches=true`
 * response, so S6 renders with no second request (docs/06 § 8, the demo's
 * 1:35 WOW moment).
 */
export function requirementMatchesKey(requirementId: string) {
  return ['requirements', requirementId, 'matches'] as const;
}

export function useRequirementMatches(requirementId: string | undefined): UseQueryResult<RequirementMatchesResponse> {
  return useQuery({
    queryKey: requirementMatchesKey(requirementId ?? ''),
    queryFn: () => getRequirementMatches(requirementId as string),
    enabled: Boolean(requirementId),
  });
}

/**
 * GET /v1/listings/{listingId} - S7's material block. Key is `['listings', listingId]`,
 * matching the `['listings']` prefix ListingNewPage.tsx already invalidates on write.
 */
export function useListing(listingId: string | undefined): UseQueryResult<ListingResponse> {
  return useQuery({
    queryKey: ['listings', listingId ?? ''],
    queryFn: () => getListing(listingId as string),
    enabled: Boolean(listingId),
  });
}

/**
 * GET /v1/reservations - S9's fallback lookup (no per-id endpoint; docs/06 § 2
 * cut-route rule) and S8's dashboard tables.
 */
export function useReservations(query?: ReservationsQuery): UseQueryResult<ReservationsResponse> {
  return useQuery({
    queryKey: ['reservations', query ?? {}],
    queryFn: () => getReservations(query),
  });
}

/**
 * GET /v1/listings?mine=true - S8's "My listings" tab. Shares the
 * `['listings']` prefix with `useListing` above, so one write invalidates
 * both the list and any open single-listing view.
 */
export function useListings(
  query?: ListingsQuery,
  options?: { enabled?: boolean },
): UseQueryResult<ListingsResponse> {
  return useQuery({
    queryKey: ['listings', query ?? {}],
    queryFn: () => getListings(query),
    enabled: options?.enabled ?? true,
  });
}

/**
 * POST /v1/reservations/{id}/handoff - shared by S8 (Incoming tab) and S9
 * (Confirm handoff), so the mutation and its cache invalidation exist once.
 * Component-specific side effects (closing a dialog, holding the fresh
 * envelope for display) are passed as per-call callbacks to `.mutate()`,
 * not baked in here - docs/06 § 11 forbids optimistic UI, so callers must
 * wait for this to resolve before updating anything themselves.
 */
export function useHandoffReservation(): UseMutationResult<
  HandoffResponse,
  Error,
  { reservationId: string; note?: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, note }) => handoffReservation(reservationId, note !== undefined ? { note } : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['impact'] });
      void queryClient.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

/**
 * GET /v1/impact - powers the home category counts and impact strip (docs/06
 * § 4) and S10. Platform scope by default; every figure traces to an
 * ImpactRecord row (docs/04 § 3).
 */
export function useImpact(query?: ImpactQuery): UseQueryResult<ImpactResponse> {
  return useQuery({
    queryKey: ['impact', query ?? null],
    queryFn: () => getImpact(query),
  });
}
