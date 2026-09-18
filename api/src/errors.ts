import type { ApiErrorCode } from '@dse/shared';

/** An expected request failure that is safe to expose through the API envelope. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly field: string | null = null,
    public readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function validationError(field: string, message: string): never {
  throw new ApiRequestError(400, 'VALIDATION_FAILED', message, field);
}
