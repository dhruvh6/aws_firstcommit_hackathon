/**
 * Request body validation for POST /listings and POST /requirements, driven
 * by fixtures/meta-categories.json so the field lists never drift from the
 * taxonomy M2 serves. OWNER: M1. docs/04-API-CONTRACT.md § 3.
 */
import type { CreateListingRequest, CreateRequirementRequest, MetaField } from '@dse/shared';
import { CONDITIONS, HANDOFF_MODES, MATERIAL_CATEGORIES } from '@dse/shared';
import { FIXTURE_META_CATEGORIES } from './fixtures.js';
import { MOCK_TODAY } from './today.js';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; field: string; message: string };

function fail(field: string, message: string): { ok: false; field: string; message: string } {
  return { ok: false, field, message };
}

function categoryMeta(category: string) {
  return FIXTURE_META_CATEGORIES.items.find((c) => c.code === category);
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function decimalsOk(n: number, maxDp: number): boolean {
  const factor = 10 ** maxDp;
  return Math.round(n * factor) / factor === n;
}

function validateFieldsObject(
  kind: 'attributeFields' | 'constraintFields',
  category: string,
  obj: unknown,
  prefix: string,
): { ok: false; field: string; message: string } | null {
  const meta = categoryMeta(category);
  if (!meta) return fail(prefix, `Unknown category "${category}"`);
  if (typeof obj !== 'object' || obj === null) return fail(prefix, `${prefix} is required`);
  const record = obj as Record<string, unknown>;
  if (record.category !== category) return fail(`${prefix}.category`, `${prefix}.category must equal ${category}`);

  const fields: MetaField[] = meta[kind];
  const allowedKeys = new Set(['category', ...fields.map((f) => f.key)]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) return fail(`${prefix}.${key}`, `${prefix}.${key} is not a recognised field for ${category}`);
  }

  for (const f of fields) {
    const value = record[f.key];
    if (value === undefined || value === null) {
      if (f.required) return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} is required`);
      continue;
    }
    if (f.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} must be a number`);
      if (f.min !== undefined && value < f.min) return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} must be >= ${f.min}`);
      if (f.max !== undefined && value > f.max) return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} must be <= ${f.max}`);
    } else if (f.type === 'boolean') {
      if (typeof value !== 'boolean') return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} must be a boolean`);
    } else if (f.type === 'text') {
      if (typeof value !== 'string') return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} must be text`);
      if (f.maxLength !== undefined && value.length > f.maxLength) return fail(`${prefix}.${f.key}`, `${prefix}.${f.key} must be <= ${f.maxLength} chars`);
    }
  }
  return null;
}

export function validateCreateListing(body: unknown): ValidationResult<CreateListingRequest> {
  if (typeof body !== 'object' || body === null) return fail('title', 'Request body must be an object');
  const b = body as Record<string, unknown>;
  const categories: readonly string[] = MATERIAL_CATEGORIES;
  const conditions: readonly string[] = CONDITIONS;
  const handoffModes: readonly string[] = HANDOFF_MODES;

  if (typeof b.title !== 'string' || b.title.length < 3 || b.title.length > 80) {
    return fail('title', 'title must be 3-80 characters');
  }
  if (typeof b.category !== 'string' || !categories.includes(b.category)) {
    return fail('category', 'category must be one of the four material categories');
  }
  if (typeof b.totalQuantity !== 'number' || !(b.totalQuantity > 0) || b.totalQuantity > 100000 || !decimalsOk(b.totalQuantity, 2)) {
    return fail('totalQuantity', 'totalQuantity must be > 0, <= 100000, max 2 decimal places');
  }
  const meta = categoryMeta(b.category);
  const allowedUnits: readonly string[] = meta?.allowedUnits ?? [];
  if (typeof b.unit !== 'string' || !allowedUnits.includes(b.unit)) {
    return fail('unit', "unit must be one of the category's allowed units");
  }
  if (typeof b.condition !== 'string' || !conditions.includes(b.condition)) {
    return fail('condition', 'condition must be a valid enum value');
  }
  const attrsError = validateFieldsObject('attributeFields', b.category, b.attributes, 'attributes');
  if (attrsError) return attrsError;

  if (!isIsoDate(b.availableFrom) || b.availableFrom < MOCK_TODAY) {
    return fail('availableFrom', 'availableFrom must be an ISO date on or after today');
  }
  const maxUntil = addDays(MOCK_TODAY, 90);
  if (!isIsoDate(b.availableUntil) || b.availableUntil < b.availableFrom || b.availableUntil > maxUntil) {
    return fail('availableUntil', 'availableUntil must be >= availableFrom and <= today + 90 days');
  }
  if (typeof b.handoffMode !== 'string' || !handoffModes.includes(b.handoffMode)) {
    return fail('handoffMode', 'handoffMode must be a valid enum value');
  }
  if (b.description !== undefined && (typeof b.description !== 'string' || b.description.length > 500)) {
    return fail('description', 'description must be <= 500 characters');
  }
  if (b.referencePriceInr !== undefined) {
    if (typeof b.referencePriceInr !== 'number' || !Number.isInteger(b.referencePriceInr) || !(b.referencePriceInr > 0) || b.referencePriceInr > 100000) {
      return fail('referencePriceInr', 'referencePriceInr must be an integer 0 < p <= 100000');
    }
  }

  return { ok: true, value: body as CreateListingRequest };
}

export function validateCreateRequirement(body: unknown): ValidationResult<CreateRequirementRequest> {
  if (typeof body !== 'object' || body === null) return fail('category', 'Request body must be an object');
  const b = body as Record<string, unknown>;
  const categories: readonly string[] = MATERIAL_CATEGORIES;
  const conditions: readonly string[] = CONDITIONS;

  if (typeof b.category !== 'string' || !categories.includes(b.category)) {
    return fail('category', 'category must be one of the four material categories');
  }
  if (typeof b.requestedQuantity !== 'number' || !(b.requestedQuantity > 0) || b.requestedQuantity > 100000 || !decimalsOk(b.requestedQuantity, 2)) {
    return fail('requestedQuantity', 'requestedQuantity must be > 0, <= 100000, max 2 decimal places');
  }
  const meta = categoryMeta(b.category);
  const allowedUnits: readonly string[] = meta?.allowedUnits ?? [];
  if (typeof b.unit !== 'string' || !allowedUnits.includes(b.unit)) {
    return fail('unit', "unit must be one of the category's allowed units");
  }
  if (!Array.isArray(b.acceptedConditions) || b.acceptedConditions.length === 0 || !b.acceptedConditions.every((c) => typeof c === 'string' && conditions.includes(c))) {
    return fail('acceptedConditions', 'acceptedConditions must be a non-empty array of valid conditions');
  }
  const constraintsError = validateFieldsObject('constraintFields', b.category, b.constraints, 'constraints');
  if (constraintsError) return constraintsError;

  if (typeof b.radiusKm !== 'number' || !Number.isInteger(b.radiusKm) || b.radiusKm < 1 || b.radiusKm > 50) {
    return fail('radiusKm', 'radiusKm must be an integer between 1 and 50');
  }
  const maxRequiredBy = addDays(MOCK_TODAY, 90);
  if (!isIsoDate(b.requiredBy) || b.requiredBy < MOCK_TODAY || b.requiredBy > maxRequiredBy) {
    return fail('requiredBy', 'requiredBy must be an ISO date between today and today + 90 days');
  }
  if (b.notes !== undefined && (typeof b.notes !== 'string' || b.notes.length > 500)) {
    return fail('notes', 'notes must be <= 500 characters');
  }

  return { ok: true, value: body as CreateRequirementRequest };
}
