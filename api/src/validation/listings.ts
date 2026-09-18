import type {
  CreateListingRequest,
  MaterialAttributes,
  MaterialCategory,
} from '@dse/shared';
import {
  CATEGORY_UNITS,
  CONDITIONS,
  HANDOFF_MODES,
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
  requiredString,
} from './common.js';

const BODY_FIELDS = [
  'title',
  'category',
  'description',
  'totalQuantity',
  'unit',
  'condition',
  'attributes',
  'availableFrom',
  'availableUntil',
  'handoffMode',
  'referencePriceInr',
  'photoKey',
] as const;

function validateAttributes(value: unknown, category: MaterialCategory): MaterialAttributes {
  const attributes = requireObject(value, 'attributes');
  if (attributes.category !== category) {
    validationError('attributes.category', 'attributes.category must match category.');
  }

  switch (category) {
    case 'WOOD_OFFCUTS': {
      rejectUnknownKeys(
        attributes,
        ['category', 'minPieceSizeCm', 'maxPieceSizeCm', 'treated', 'woodType'],
        'attributes',
      );
      const minPieceSizeCm = numberInRange(attributes.minPieceSizeCm, 'attributes.minPieceSizeCm', 1, 500);
      const maxPieceSizeCm = numberInRange(attributes.maxPieceSizeCm, 'attributes.maxPieceSizeCm', 1, 500);
      if (maxPieceSizeCm < minPieceSizeCm) {
        validationError('attributes.maxPieceSizeCm', 'Largest piece size cannot be smaller than the smallest piece size.');
      }
      const result: Extract<MaterialAttributes, { category: 'WOOD_OFFCUTS' }> = {
        category,
        minPieceSizeCm,
        maxPieceSizeCm,
        treated: booleanValue(attributes.treated, 'attributes.treated'),
      };
      const woodType = optionalString(attributes.woodType, 'attributes.woodType', 40);
      if (woodType !== undefined) result.woodType = woodType;
      return result;
    }
    case 'FABRIC_OFFCUTS': {
      rejectUnknownKeys(
        attributes,
        ['category', 'minPieceLengthCm', 'maxPieceLengthCm', 'fabricType', 'gsm'],
        'attributes',
      );
      const minPieceLengthCm = numberInRange(attributes.minPieceLengthCm, 'attributes.minPieceLengthCm', 1, 2000);
      const maxPieceLengthCm = numberInRange(attributes.maxPieceLengthCm, 'attributes.maxPieceLengthCm', 1, 2000);
      if (maxPieceLengthCm < minPieceLengthCm) {
        validationError('attributes.maxPieceLengthCm', 'Longest piece length cannot be shorter than the shortest piece length.');
      }
      const result: Extract<MaterialAttributes, { category: 'FABRIC_OFFCUTS' }> = {
        category,
        minPieceLengthCm,
        maxPieceLengthCm,
      };
      const fabricType = optionalString(attributes.fabricType, 'attributes.fabricType', 40);
      if (fabricType !== undefined) result.fabricType = fabricType;
      if (attributes.gsm !== undefined) {
        result.gsm = numberInRange(attributes.gsm, 'attributes.gsm', 20, 1000);
      }
      return result;
    }
    case 'PACKAGING_CARDBOARD': {
      rejectUnknownKeys(
        attributes,
        ['category', 'ply', 'printed', 'flatDimensionsCm'],
        'attributes',
      );
      const result: Extract<MaterialAttributes, { category: 'PACKAGING_CARDBOARD' }> = {
        category,
        printed: booleanValue(attributes.printed, 'attributes.printed'),
      };
      if (attributes.ply !== undefined) {
        result.ply = numberInRange(attributes.ply, 'attributes.ply', 1, 12, { integer: true });
      }
      const dimensions = optionalString(attributes.flatDimensionsCm, 'attributes.flatDimensionsCm', 40);
      if (dimensions !== undefined) result.flatDimensionsCm = dimensions;
      return result;
    }
    case 'ACRYLIC_SHEET': {
      rejectUnknownKeys(
        attributes,
        ['category', 'thicknessMm', 'minSheetSizeCm', 'maxSheetSizeCm', 'colour'],
        'attributes',
      );
      const minSheetSizeCm = numberInRange(attributes.minSheetSizeCm, 'attributes.minSheetSizeCm', 1, 300);
      const maxSheetSizeCm = numberInRange(attributes.maxSheetSizeCm, 'attributes.maxSheetSizeCm', 1, 300);
      if (maxSheetSizeCm < minSheetSizeCm) {
        validationError('attributes.maxSheetSizeCm', 'Largest sheet size cannot be smaller than the smallest sheet size.');
      }
      const result: Extract<MaterialAttributes, { category: 'ACRYLIC_SHEET' }> = {
        category,
        thicknessMm: numberInRange(attributes.thicknessMm, 'attributes.thicknessMm', 1, 50),
        minSheetSizeCm,
        maxSheetSizeCm,
      };
      const colour = optionalString(attributes.colour, 'attributes.colour', 30);
      if (colour !== undefined) result.colour = colour;
      return result;
    }
  }
}

export function validateCreateListing(
  value: unknown,
  today: string,
): CreateListingRequest {
  const body = requireObject(value);
  rejectUnknownKeys(body, BODY_FIELDS);

  const category = enumValue(body.category, 'category', MATERIAL_CATEGORIES);
  const unit = enumValue(body.unit, 'unit', UNITS);
  if (!CATEGORY_UNITS[category].allowedUnits.includes(unit)) {
    validationError('unit', `unit is not allowed for ${category}.`);
  }

  const availableFrom = isoDate(body.availableFrom, 'availableFrom');
  const availableUntil = isoDate(body.availableUntil, 'availableUntil');
  if (availableFrom < today) {
    validationError('availableFrom', 'availableFrom cannot be in the past.');
  }
  if (availableUntil < availableFrom) {
    validationError('availableUntil', 'availableUntil cannot be before availableFrom.');
  }
  if (availableUntil > addUtcDays(today, 90)) {
    validationError('availableUntil', 'availableUntil cannot be more than 90 days from today.');
  }

  const result: CreateListingRequest = {
    title: requiredString(body.title, 'title', 3, 80),
    category,
    totalQuantity: numberInRange(body.totalQuantity, 'totalQuantity', Number.EPSILON, 100000, {
      maximumDecimals: 2,
    }),
    unit,
    condition: enumValue(body.condition, 'condition', CONDITIONS),
    attributes: validateAttributes(body.attributes, category),
    availableFrom,
    availableUntil,
    handoffMode: enumValue(body.handoffMode, 'handoffMode', HANDOFF_MODES),
  };

  const description = optionalString(body.description, 'description', 500);
  if (description !== undefined) result.description = description;
  if (body.referencePriceInr !== undefined) {
    result.referencePriceInr = numberInRange(
      body.referencePriceInr,
      'referencePriceInr',
      1,
      100000,
      { integer: true },
    );
  }
  const photoKey = optionalString(body.photoKey, 'photoKey', 500);
  if (photoKey !== undefined) result.photoKey = photoKey;
  return result;
}
