import type {
  AttributeConstraints,
  CreateRequirementRequest,
  MaterialCategory,
} from '@dse/shared';
import {
  CATEGORY_UNITS,
  CONDITIONS,
  MATERIAL_CATEGORIES,
  UNITS,
} from '@dse/shared';
import { validationError } from '../errors.js';
import {
  addUtcDays,
  booleanValue,
  enumValue,
  isoDate,
  numberInRange,
  optionalString,
  rejectUnknownKeys,
  requireObject,
} from './common.js';

const BODY_FIELDS = [
  'category',
  'requestedQuantity',
  'unit',
  'acceptedConditions',
  'constraints',
  'radiusKm',
  'requiredBy',
  'notes',
] as const;

function optionalNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  integer = false,
): number | undefined {
  return value === undefined
    ? undefined
    : numberInRange(value, field, minimum, maximum, { integer });
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  return value === undefined ? undefined : booleanValue(value, field);
}

function validateConstraints(value: unknown, category: MaterialCategory): AttributeConstraints {
  const constraints = requireObject(value, 'constraints');
  if (constraints.category !== category) {
    validationError('constraints.category', 'constraints.category must match category.');
  }

  switch (category) {
    case 'WOOD_OFFCUTS': {
      rejectUnknownKeys(
        constraints,
        ['category', 'minPieceSizeCm', 'allowTreated', 'woodType'],
        'constraints',
      );
      const result: Extract<AttributeConstraints, { category: 'WOOD_OFFCUTS' }> = { category };
      const minimum = optionalNumber(constraints.minPieceSizeCm, 'constraints.minPieceSizeCm', 1, 500);
      if (minimum !== undefined) result.minPieceSizeCm = minimum;
      const allowTreated = optionalBoolean(constraints.allowTreated, 'constraints.allowTreated');
      if (allowTreated !== undefined) result.allowTreated = allowTreated;
      const woodType = optionalString(constraints.woodType, 'constraints.woodType', 40);
      if (woodType !== undefined) result.woodType = woodType;
      return result;
    }
    case 'FABRIC_OFFCUTS': {
      rejectUnknownKeys(
        constraints,
        ['category', 'minPieceLengthCm', 'fabricType', 'minGsm', 'maxGsm'],
        'constraints',
      );
      const result: Extract<AttributeConstraints, { category: 'FABRIC_OFFCUTS' }> = { category };
      const minimumLength = optionalNumber(
        constraints.minPieceLengthCm,
        'constraints.minPieceLengthCm',
        1,
        2000,
      );
      if (minimumLength !== undefined) result.minPieceLengthCm = minimumLength;
      const fabricType = optionalString(constraints.fabricType, 'constraints.fabricType', 40);
      if (fabricType !== undefined) result.fabricType = fabricType;
      const minGsm = optionalNumber(constraints.minGsm, 'constraints.minGsm', 20, 1000);
      const maxGsm = optionalNumber(constraints.maxGsm, 'constraints.maxGsm', 20, 1000);
      if (minGsm !== undefined) result.minGsm = minGsm;
      if (maxGsm !== undefined) result.maxGsm = maxGsm;
      if (minGsm !== undefined && maxGsm !== undefined && minGsm > maxGsm) {
        validationError('constraints.maxGsm', 'Maximum GSM cannot be less than minimum GSM.');
      }
      return result;
    }
    case 'PACKAGING_CARDBOARD': {
      rejectUnknownKeys(constraints, ['category', 'minPly', 'allowPrinted'], 'constraints');
      const result: Extract<AttributeConstraints, { category: 'PACKAGING_CARDBOARD' }> = { category };
      const minPly = optionalNumber(constraints.minPly, 'constraints.minPly', 1, 12, true);
      if (minPly !== undefined) result.minPly = minPly;
      const allowPrinted = optionalBoolean(constraints.allowPrinted, 'constraints.allowPrinted');
      if (allowPrinted !== undefined) result.allowPrinted = allowPrinted;
      return result;
    }
    case 'ACRYLIC_SHEET': {
      rejectUnknownKeys(
        constraints,
        ['category', 'minThicknessMm', 'maxThicknessMm', 'minSheetSizeCm', 'colour'],
        'constraints',
      );
      const result: Extract<AttributeConstraints, { category: 'ACRYLIC_SHEET' }> = { category };
      const minThickness = optionalNumber(
        constraints.minThicknessMm,
        'constraints.minThicknessMm',
        1,
        50,
      );
      const maxThickness = optionalNumber(
        constraints.maxThicknessMm,
        'constraints.maxThicknessMm',
        1,
        50,
      );
      if (minThickness !== undefined) result.minThicknessMm = minThickness;
      if (maxThickness !== undefined) result.maxThicknessMm = maxThickness;
      if (minThickness !== undefined && maxThickness !== undefined && minThickness > maxThickness) {
        validationError(
          'constraints.maxThicknessMm',
          'Maximum thickness cannot be less than minimum thickness.',
        );
      }
      const minSize = optionalNumber(constraints.minSheetSizeCm, 'constraints.minSheetSizeCm', 1, 300);
      if (minSize !== undefined) result.minSheetSizeCm = minSize;
      const colour = optionalString(constraints.colour, 'constraints.colour', 30);
      if (colour !== undefined) result.colour = colour;
      return result;
    }
  }
}

export function validateCreateRequirement(
  value: unknown,
  today: string,
): CreateRequirementRequest {
  const body = requireObject(value);
  rejectUnknownKeys(body, BODY_FIELDS);

  const category = enumValue(body.category, 'category', MATERIAL_CATEGORIES);
  const unit = enumValue(body.unit, 'unit', UNITS);
  if (!CATEGORY_UNITS[category].allowedUnits.includes(unit)) {
    validationError('unit', `unit is not allowed for ${category}.`);
  }
  if (!Array.isArray(body.acceptedConditions) || body.acceptedConditions.length === 0) {
    validationError('acceptedConditions', 'Select at least one accepted condition.');
  }
  const acceptedConditions = body.acceptedConditions.map((condition) => (
    enumValue(condition, 'acceptedConditions', CONDITIONS)
  ));
  if (new Set(acceptedConditions).size !== acceptedConditions.length) {
    validationError('acceptedConditions', 'acceptedConditions cannot contain duplicates.');
  }

  const requiredBy = isoDate(body.requiredBy, 'requiredBy');
  if (requiredBy < today) validationError('requiredBy', 'requiredBy cannot be in the past.');
  if (requiredBy > addUtcDays(today, 90)) {
    validationError('requiredBy', 'requiredBy cannot be more than 90 days from today.');
  }

  const result: CreateRequirementRequest = {
    category,
    requestedQuantity: numberInRange(
      body.requestedQuantity,
      'requestedQuantity',
      Number.EPSILON,
      100000,
      { maximumDecimals: 2 },
    ),
    unit,
    acceptedConditions,
    constraints: validateConstraints(body.constraints, category),
    radiusKm: numberInRange(body.radiusKm, 'radiusKm', 1, 50, { integer: true }),
    requiredBy,
  };
  const notes = optionalString(body.notes, 'notes', 500);
  if (notes !== undefined) result.notes = notes;
  return result;
}
