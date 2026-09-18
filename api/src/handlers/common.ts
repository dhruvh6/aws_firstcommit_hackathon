import type { Business } from '@dse/shared';
import { ApiRequestError } from '../errors.js';
import { getRepo } from '../repo/runtime.js';
import type { RouterRequest } from '../router.js';

export function headerValue(req: RouterRequest, name: string): string | undefined {
  const wanted = name.toLocaleLowerCase();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLocaleLowerCase() === wanted) return value?.trim() || undefined;
  }
  return undefined;
}

export async function requireActingBusiness(req: RouterRequest): Promise<Business> {
  const businessId = headerValue(req, 'x-business-id');
  if (!businessId) {
    throw new ApiRequestError(
      401,
      'BUSINESS_NOT_IDENTIFIED',
      'Select a business before performing this action.',
    );
  }
  const business = await getRepo().getBusiness(businessId);
  if (!business) {
    throw new ApiRequestError(
      401,
      'BUSINESS_NOT_IDENTIFIED',
      'The selected business does not exist.',
    );
  }
  return business;
}

export async function optionalActingBusiness(req: RouterRequest): Promise<Business | null> {
  const businessId = headerValue(req, 'x-business-id');
  if (!businessId) return null;
  const business = await getRepo().getBusiness(businessId);
  if (!business) {
    throw new ApiRequestError(
      401,
      'BUSINESS_NOT_IDENTIFIED',
      'The selected business does not exist.',
    );
  }
  return business;
}

export function queryValue(req: RouterRequest, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return value.at(-1);
  return value;
}

export function queryValues(req: RouterRequest, key: string): string[] | undefined {
  const value = req.query[key];
  if (value === undefined) return undefined;
  const values = (Array.isArray(value) ? value : [value])
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}
