/**
 * TanStack Query hooks layered on api/client.ts. OWNER: M1.
 */
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { MetaCategoriesResponse, RequirementMatchesResponse } from '@dse/shared';
import { getMetaCategories, getRequirementMatches } from './client.js';

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
