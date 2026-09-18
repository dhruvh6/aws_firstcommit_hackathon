/**
 * TanStack Query hooks layered on api/client.ts. OWNER: M1.
 */
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { MetaCategoriesResponse } from '@dse/shared';
import { getMetaCategories } from './client.js';

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
