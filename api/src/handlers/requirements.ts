import { randomUUID } from 'node:crypto';
import type {
  MaterialCategory,
  Requirement,
  RequirementsResponse,
  RequirementStatus,
} from '@dse/shared';
import { MATERIAL_CATEGORIES, REQUIREMENT_STATUS } from '@dse/shared';
import { ApiRequestError, validationError } from '../errors.js';
import type { RequirementFilter } from '../repo/index.js';
import { getRepo } from '../repo/runtime.js';
import type { Handler, RouterRequest } from '../router.js';
import { enumValue, numberInRange } from '../validation/common.js';
import { validateCreateRequirement } from '../validation/requirements.js';
import {
  optionalActingBusiness,
  queryValue,
  queryValues,
  requireActingBusiness,
} from './common.js';
import { matchesForRequirement } from './matches.js';

function parseBoolean(req: RouterRequest, key: string, defaultValue: boolean): boolean {
  const raw = queryValue(req, key);
  if (raw === undefined) return defaultValue;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  validationError(key, `${key} must be true or false.`);
}

function parseEnumList<T extends string>(
  req: RouterRequest,
  key: string,
  allowed: readonly T[],
): T[] | undefined {
  return queryValues(req, key)?.map((value) => enumValue(value, key, allowed));
}

function parseLimit(req: RouterRequest): number | undefined {
  const raw = queryValue(req, 'limit');
  if (raw === undefined) return undefined;
  if (raw.trim() === '' || !Number.isFinite(Number(raw))) {
    validationError('limit', 'limit must be a number.');
  }
  return numberInRange(Number(raw), 'limit', 1, 100, { integer: true });
}

export const createRequirement: Handler = async (req) => {
  const business = await requireActingBusiness(req);
  // Validate query parameters before persisting anything.
  const withMatches = parseBoolean(req, 'withMatches', false);
  const createdAt = new Date().toISOString();
  const input = validateCreateRequirement(req.body, createdAt.slice(0, 10));
  const requirement: Requirement = {
    requirementId: `req_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    businessId: business.businessId,
    businessName: business.name,
    category: input.category,
    requestedQuantity: input.requestedQuantity,
    fulfilledQuantity: 0,
    reservedQuantity: 0,
    unit: input.unit,
    acceptedConditions: input.acceptedConditions,
    constraints: input.constraints,
    area: business.area,
    city: business.city,
    location: business.location,
    radiusKm: input.radiusKm,
    requiredBy: input.requiredBy,
    status: 'OPEN',
    createdAt,
    updatedAt: createdAt,
  };
  if (input.notes !== undefined) requirement.notes = input.notes;
  const created = await getRepo().createRequirement(requirement);

  if (!withMatches) return { status: 201, body: created };
  const result = await matchesForRequirement(created, {
    includeNearMisses: true,
    limit: 20,
    evaluatedAt: createdAt,
  });
  return { status: 201, body: { requirement: created, matches: result.items } };
};

export const listRequirements: Handler = async (req) => {
  const mine = parseBoolean(req, 'mine', false);
  const actingBusiness = mine ? await requireActingBusiness(req) : await optionalActingBusiness(req);
  const statuses = parseEnumList<RequirementStatus>(req, 'status', REQUIREMENT_STATUS);
  const categories = parseEnumList<MaterialCategory>(req, 'category', MATERIAL_CATEGORIES);
  const filter: RequirementFilter = {
    businessId: mine ? actingBusiness!.businessId : undefined,
    statuses: statuses ?? (mine ? undefined : ['OPEN', 'PARTIALLY_FULFILLED']),
    categories,
    city: queryValue(req, 'city') ?? 'Mumbai',
    limit: parseLimit(req),
    cursor: queryValue(req, 'cursor'),
  };
  const page = await getRepo().queryRequirements(filter);
  const body: RequirementsResponse = {
    items: page.items,
    meta: {
      count: page.items.length,
      nextCursor: page.nextCursor,
      truncated: page.truncated,
    },
  };
  return { status: 200, body };
};

export const getRequirement: Handler = async (_req, params) => {
  const requirementId = params.requirementId!;
  const requirement = await getRepo().getRequirement(requirementId);
  if (!requirement) {
    throw new ApiRequestError(
      404,
      'REQUIREMENT_NOT_FOUND',
      `Requirement ${requirementId} was not found.`,
    );
  }
  return { status: 200, body: requirement };
};
