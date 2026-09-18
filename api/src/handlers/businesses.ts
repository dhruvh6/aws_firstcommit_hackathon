import type { BusinessesResponse } from '@dse/shared';
import { ApiRequestError } from '../errors.js';
import { getRepo } from '../repo/runtime.js';
import type { Handler } from '../router.js';

export const listBusinesses: Handler = async () => {
  const items = await getRepo().listBusinesses();
  const body: BusinessesResponse = {
    items,
    meta: { count: items.length, nextCursor: null, truncated: false },
  };
  return { status: 200, body };
};

export const getBusiness: Handler = async (_req, params) => {
  const businessId = params.businessId!;
  const business = await getRepo().getBusiness(businessId);
  if (!business) {
    throw new ApiRequestError(
      404,
      'BUSINESS_NOT_FOUND',
      `Business ${businessId} was not found.`,
    );
  }
  return { status: 200, body: business };
};
