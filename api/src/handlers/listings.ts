import { randomUUID } from 'node:crypto';
import type {
  Condition,
  ListingListItem,
  ListingsResponse,
  ListingSort,
  ListingStatus,
  MaterialCategory,
  SurplusListing,
} from '@dse/shared';
import {
  CONDITIONS,
  LISTING_SORTS,
  LISTING_STATUS,
  MATERIAL_CATEGORIES,
} from '@dse/shared';
import { distanceKm } from '../domain/distance.js';
import { ApiRequestError, validationError } from '../errors.js';
import { getRepo } from '../repo/runtime.js';
import type { ListingFilter } from '../repo/index.js';
import type { Handler, RouterRequest } from '../router.js';
import { enumValue, isoDate, numberInRange } from '../validation/common.js';
import { validateCreateListing } from '../validation/listings.js';
import {
  optionalActingBusiness,
  queryValue,
  queryValues,
  requireActingBusiness,
} from './common.js';

function parseEnumList<T extends string>(
  req: RouterRequest,
  key: string,
  allowed: readonly T[],
): T[] | undefined {
  return queryValues(req, key)?.map((value) => enumValue(value, key, allowed));
}

function parseOptionalNumber(
  req: RouterRequest,
  key: string,
  minimum: number,
  maximum: number,
  integer = false,
): number | undefined {
  const raw = queryValue(req, key);
  if (raw === undefined) return undefined;
  if (raw.trim() === '' || !Number.isFinite(Number(raw))) {
    validationError(key, `${key} must be a number.`);
  }
  return numberInRange(Number(raw), key, minimum, maximum, { integer });
}

function parseBoolean(req: RouterRequest, key: string, defaultValue: boolean): boolean {
  const raw = queryValue(req, key);
  if (raw === undefined) return defaultValue;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  validationError(key, `${key} must be true or false.`);
}

async function resolveOrigin(req: RouterRequest) {
  const explicitOriginId = queryValue(req, 'originBusinessId');
  if (explicitOriginId) {
    const business = await getRepo().getBusiness(explicitOriginId);
    if (!business) {
      throw new ApiRequestError(
        404,
        'BUSINESS_NOT_FOUND',
        `Business ${explicitOriginId} was not found.`,
      );
    }
    return business;
  }
  return optionalActingBusiness(req);
}

function todayFrom(timestamp: string): string {
  return timestamp.slice(0, 10);
}

export const createListing: Handler = async (req) => {
  const business = await requireActingBusiness(req);
  const createdAt = new Date().toISOString();
  const input = validateCreateListing(req.body, todayFrom(createdAt));
  const listing: SurplusListing = {
    listingId: `lst_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    businessId: business.businessId,
    businessName: business.name,
    title: input.title,
    category: input.category,
    totalQuantity: input.totalQuantity,
    availableQuantity: input.totalQuantity,
    reservedQuantity: 0,
    handedOffQuantity: 0,
    unit: input.unit,
    condition: input.condition,
    attributes: input.attributes,
    area: business.area,
    city: business.city,
    location: business.location,
    availableFrom: input.availableFrom,
    availableUntil: input.availableUntil,
    handoffMode: input.handoffMode,
    status: 'ACTIVE',
    createdAt,
    updatedAt: createdAt,
  };
  if (input.description !== undefined) listing.description = input.description;
  if (input.referencePriceInr !== undefined) listing.referencePriceInr = input.referencePriceInr;
  if (input.photoKey !== undefined) listing.photoKey = input.photoKey;

  return { status: 201, body: await getRepo().createListing(listing) };
};

export const listListings: Handler = async (req) => {
  const mine = parseBoolean(req, 'mine', false);
  const actingBusiness = mine ? await requireActingBusiness(req) : await optionalActingBusiness(req);
  const origin = await resolveOrigin(req);
  const categories = parseEnumList<MaterialCategory>(req, 'category', MATERIAL_CATEGORIES);
  const conditions = parseEnumList<Condition>(req, 'condition', CONDITIONS);
  const explicitStatuses = parseEnumList<ListingStatus>(req, 'status', LISTING_STATUS);
  const sort = enumValue(queryValue(req, 'sort') ?? 'RECENT', 'sort', LISTING_SORTS) as ListingSort;
  const maxDistanceKm = parseOptionalNumber(req, 'maxDistanceKm', 0, 50000);
  if (sort === 'DISTANCE_ASC' && !origin) {
    validationError('sort', 'DISTANCE_ASC requires an origin business or X-Business-Id header.');
  }

  const availableOnRaw = queryValue(req, 'availableOn');
  const availableOn = availableOnRaw === undefined ? undefined : isoDate(availableOnRaw, 'availableOn');
  const filter: ListingFilter = {
    businessId: mine ? actingBusiness!.businessId : undefined,
    categories,
    conditions,
    statuses: explicitStatuses ?? (mine ? undefined : ['ACTIVE', 'PARTIALLY_RESERVED']),
    city: queryValue(req, 'city') ?? 'Mumbai',
    query: queryValue(req, 'q'),
    minAvailableQuantity: parseOptionalNumber(req, 'minQuantity', 0, 100000),
    maxAvailableQuantity: parseOptionalNumber(req, 'maxQuantity', 0, 100000),
    availableOn,
    origin: origin?.location,
    maxDistanceKm,
    sort,
    limit: parseOptionalNumber(req, 'limit', 1, 100, true),
    cursor: queryValue(req, 'cursor'),
  };
  if (
    filter.minAvailableQuantity !== undefined
    && filter.maxAvailableQuantity !== undefined
    && filter.minAvailableQuantity > filter.maxAvailableQuantity
  ) {
    validationError('maxQuantity', 'maxQuantity cannot be less than minQuantity.');
  }

  const page = await getRepo().queryListings(filter);
  const items: ListingListItem[] = page.items.map((listing) => (
    origin ? { ...listing, distanceKm: distanceKm(origin.location, listing.location) } : listing
  ));
  const body: ListingsResponse = {
    items,
    meta: {
      count: items.length,
      nextCursor: page.nextCursor,
      truncated: page.truncated,
    },
  };
  return { status: 200, body };
};

export const getListing: Handler = async (req, params) => {
  const listingId = params.listingId!;
  const listing = await getRepo().getListing(listingId);
  if (!listing) {
    throw new ApiRequestError(
      404,
      'LISTING_NOT_FOUND',
      `Listing ${listingId} was not found.`,
    );
  }
  const origin = await resolveOrigin(req);
  const body: ListingListItem = origin
    ? { ...listing, distanceKm: distanceKm(origin.location, listing.location) }
    : listing;
  return { status: 200, body };
};
