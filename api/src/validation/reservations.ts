import type { CreateReservationRequest, HandoffRequest } from '@dse/shared';
import {
  numberInRange,
  optionalString,
  rejectUnknownKeys,
  requireObject,
  requiredString,
} from './common.js';

const CREATE_FIELDS = ['listingId', 'requirementId', 'reservedQuantity'] as const;
const HANDOFF_FIELDS = ['note'] as const;

export function validateCreateReservation(value: unknown): CreateReservationRequest {
  const body = requireObject(value);
  rejectUnknownKeys(body, CREATE_FIELDS);
  const result: CreateReservationRequest = {
    listingId: requiredString(body.listingId, 'listingId', 1, 100),
    reservedQuantity: numberInRange(
      body.reservedQuantity,
      'reservedQuantity',
      Number.EPSILON,
      100000,
      { maximumDecimals: 2 },
    ),
  };
  const requirementId = optionalString(body.requirementId, 'requirementId', 100);
  if (requirementId !== undefined) result.requirementId = requirementId;
  return result;
}

export function validateHandoff(value: unknown): HandoffRequest {
  const body = requireObject(value ?? {});
  rejectUnknownKeys(body, HANDOFF_FIELDS);
  const note = optionalString(body.note, 'note', 200);
  return note === undefined ? {} : { note };
}
