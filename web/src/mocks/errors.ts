/**
 * ApiErrorResponse envelope builder for MSW handlers. OWNER: M1.
 * Every non-2xx mock response goes through this - docs/04-API-CONTRACT.md § 1.
 */
import { HttpResponse } from 'msw';
import type { ApiErrorCode } from '@dse/shared';

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  opts?: { field?: string | null; details?: Record<string, unknown> | null },
) {
  return HttpResponse.json(
    { error: { code, message, field: opts?.field ?? null, details: opts?.details ?? null } },
    { status },
  );
}
