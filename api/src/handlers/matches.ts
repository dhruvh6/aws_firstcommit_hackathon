import type {
  ListingMatchesResponse,
  Match,
  MatchMeta,
  Requirement,
  RequirementMatchesResponse,
  SupplierMatch,
  SurplusListing,
} from '@dse/shared';
import { compareMatches, findMatches } from '../domain/matching.js';
import { ApiRequestError, validationError } from '../errors.js';
import type { ListingFilter, RequirementFilter } from '../repo/index.js';
import { getRepo } from '../repo/runtime.js';
import type { Handler, RouterRequest } from '../router.js';
import { numberInRange } from '../validation/common.js';
import { queryValue, requireActingBusiness } from './common.js';

interface MatchOptions {
  includeNearMisses: boolean;
  limit: number;
  evaluatedAt: string;
}

async function collectListings(filter: ListingFilter): Promise<SurplusListing[]> {
  const items: SurplusListing[] = [];
  let cursor: string | undefined;
  do {
    const page = await getRepo().queryListings({ ...filter, limit: 100, cursor });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

async function collectRequirements(filter: RequirementFilter): Promise<Requirement[]> {
  const items: Requirement[] = [];
  let cursor: string | undefined;
  do {
    const page = await getRepo().queryRequirements({ ...filter, limit: 100, cursor });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

function parseBoolean(req: RouterRequest, key: string, defaultValue: boolean): boolean {
  const raw = queryValue(req, key);
  if (raw === undefined) return defaultValue;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  validationError(key, `${key} must be true or false.`);
}

function parseLimit(req: RouterRequest): number {
  const raw = queryValue(req, 'limit');
  if (raw === undefined) return 20;
  if (raw.trim() === '' || !Number.isFinite(Number(raw))) {
    validationError('limit', 'limit must be a number.');
  }
  return numberInRange(Number(raw), 'limit', 1, 50, { integer: true });
}

function capMatches(allMatches: Match[], options: MatchOptions): { items: Match[]; meta: MatchMeta } {
  const allCompatible = allMatches.filter((match) => match.compatible);
  const allNearMisses = allMatches.filter((match) => !match.compatible);
  const compatible = allCompatible.slice(0, options.limit);
  const nearMisses = options.includeNearMisses ? allNearMisses.slice(0, 10) : [];
  const items = [...compatible, ...nearMisses];
  return {
    items,
    meta: {
      count: items.length,
      compatibleCount: compatible.length,
      nearMissCount: nearMisses.length,
      truncated: allCompatible.length > compatible.length
        || (options.includeNearMisses && allNearMisses.length > nearMisses.length),
      evaluatedAt: options.evaluatedAt,
    },
  };
}

export async function matchesForRequirement(
  requirement: Requirement,
  options: MatchOptions,
): Promise<{ items: Match[]; meta: MatchMeta }> {
  const candidates = await collectListings({
    categories: [requirement.category],
    statuses: ['ACTIVE', 'PARTIALLY_RESERVED'],
  });
  const matches = findMatches({
    requirement,
    listings: candidates,
    today: options.evaluatedAt.slice(0, 10),
    includeNearMisses: true,
  });
  return capMatches(matches, options);
}

export const getRequirementMatches: Handler = async (req, params) => {
  const actingBusiness = await requireActingBusiness(req);
  const requirementId = params.requirementId!;
  const requirement = await getRepo().getRequirement(requirementId);
  if (!requirement) {
    throw new ApiRequestError(
      404,
      'REQUIREMENT_NOT_FOUND',
      `Requirement ${requirementId} was not found.`,
    );
  }
  if (requirement.businessId !== actingBusiness.businessId) {
    throw new ApiRequestError(
      403,
      'NOT_YOUR_REQUIREMENT',
      'Only the business that posted this requirement can view its matches.',
    );
  }
  if (requirement.status === 'FULFILLED' || requirement.status === 'CANCELLED' || requirement.status === 'EXPIRED') {
    throw new ApiRequestError(
      409,
      'INVALID_STATE',
      `Requirement ${requirementId} is ${requirement.status.toLocaleLowerCase()} and cannot be matched.`,
    );
  }

  const evaluatedAt = new Date().toISOString();
  const result = await matchesForRequirement(requirement, {
    includeNearMisses: parseBoolean(req, 'includeNearMisses', true),
    limit: parseLimit(req),
    evaluatedAt,
  });
  const body: RequirementMatchesResponse = { requirement, ...result };
  return { status: 200, body };
};

export const getListingMatches: Handler = async (req, params) => {
  const actingBusiness = await requireActingBusiness(req);
  const listingId = params.listingId!;
  const listing = await getRepo().getListing(listingId);
  if (!listing) {
    throw new ApiRequestError(404, 'LISTING_NOT_FOUND', `Listing ${listingId} was not found.`);
  }
  if (listing.businessId !== actingBusiness.businessId) {
    throw new ApiRequestError(
      403,
      'NOT_YOUR_LISTING',
      'Only the supplier that posted this listing can view its matches.',
    );
  }

  const includeNearMisses = parseBoolean(req, 'includeNearMisses', true);
  const limit = parseLimit(req);
  const evaluatedAt = new Date().toISOString();
  const requirements = await collectRequirements({
    categories: [listing.category],
    statuses: ['OPEN', 'PARTIALLY_FULFILLED'],
  });
  const all = requirements
    .flatMap((requirement) => findMatches({
      requirement,
      listings: [listing],
      today: evaluatedAt.slice(0, 10),
      includeNearMisses: true,
    }))
    .sort(compareMatches);
  const capped = capMatches(all, { includeNearMisses, limit, evaluatedAt });
  const requirementById = new Map(requirements.map((requirement) => [requirement.requirementId, requirement]));
  const items: SupplierMatch[] = capped.items.map((match) => {
    const { listing: _embeddedListing, ...rest } = match;
    return { ...rest, requirement: requirementById.get(match.requirementId)! };
  });
  const body: ListingMatchesResponse = { listing, items, meta: capped.meta };
  return { status: 200, body };
};
