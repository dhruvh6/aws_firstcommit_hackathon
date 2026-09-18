/**
 * Shared QueryClient singleton. OWNER: M1.
 *
 * Pulled out of main.tsx so state/actingBusiness.ts (resetQueries on a
 * business switch) and the mutation-error toast below can both reach the
 * same instance without prop-drilling or context.
 */
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client.js';
import { toast } from './state/toast.js';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Set by forms that already show the failure inline - docs/06 § 3. */
      silentErrorToast?: boolean;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silentErrorToast) return;
      if (error instanceof ApiError) {
        toast.error(error.message);
        return;
      }
      toast.error('Cannot reach the exchange. Try again.');
    },
  }),
});
