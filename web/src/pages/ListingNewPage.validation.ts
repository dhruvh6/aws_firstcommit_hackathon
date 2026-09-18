/**
 * Client-side mirror of docs/04-API-CONTRACT.md § 3 `POST /v1/listings`
 * validation table, driven by the live `CategoryMeta` from
 * GET /v1/meta/categories so it can never hardcode a per-category field
 * list. This is a convenience only - the server remains the authority
 * (docs/06 § 7) - but the field paths here MUST match the server's
 * `error.field` strings exactly, because both drive the same
 * `fieldId()` -> input-id lookup. OWNER: M1.
 */
import type { CategoryMeta, CreateListingRequest, MaterialAttributes } from '@dse/shared';
import { CONDITIONS, HANDOFF_MODES, MATERIAL_CATEGORIES } from '@dse/shared';
import type { Condition, HandoffMode, MaterialCategory, Unit } from '@dse/shared';

export interface ListingFormState {
  title: string;
  category: MaterialCategory | null;
  description: string;
  totalQuantity: string;
  unit: Unit | null;
  condition: Condition | null;
  /** Raw values keyed by attribute key. Booleans are '' | 'true' | 'false'. */
  attributes: Record<string, string>;
  availableFrom: string;
  availableUntil: string;
  handoffMode: HandoffMode;
  referencePriceInr: string;
}

export const INITIAL_LISTING_FORM: ListingFormState = {
  title: '',
  category: null,
  description: '',
  totalQuantity: '',
  unit: null,
  condition: null,
  attributes: {},
  availableFrom: '',
  availableUntil: '',
  handoffMode: 'PICKUP',
  referencePriceInr: '',
};

/** Every field path this form can produce, in server-table order (docs/04 § 3). */
export function fieldOrder(categoryMeta: CategoryMeta | null): string[] {
  const attributeKeys = categoryMeta ? categoryMeta.attributeFields.map((f) => `attributes.${f.key}`) : [];
  return [
    'title',
    'category',
    'totalQuantity',
    'unit',
    'condition',
    ...attributeKeys,
    'availableFrom',
    'availableUntil',
    'handoffMode',
    'description',
    'referencePriceInr',
  ];
}

/** `attributes.minPieceSizeCm` -> `field-attributes-minPieceSizeCm`, matching the server's `error.field`. */
export function fieldId(path: string): string {
  return `field-${path.replace(/\./g, '-')}`;
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00.000Z`));
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

export type ListingFormErrors = Record<string, string>;

/**
 * Validates one field at a time (for on-blur checks) - see `validateAll` for
 * the submit-time pass. `today` is the real current date (ISO), never
 * mocks/today.ts's fixed clock.
 */
export function validateField(
  path: string,
  state: ListingFormState,
  categoryMeta: CategoryMeta | null,
  today: string,
): string | undefined {
  switch (path) {
    case 'title': {
      const len = state.title.trim().length;
      if (len === 0) return 'Title is required.';
      if (len < 3 || len > 80) return 'Title must be 3-80 characters.';
      return undefined;
    }
    case 'category':
      if (!state.category) return 'Choose a category.';
      return undefined;
    case 'totalQuantity': {
      if (state.totalQuantity.trim() === '') return 'Quantity is required.';
      const n = Number(state.totalQuantity);
      if (Number.isNaN(n) || !(n > 0) || n > 100000 || !decimalsOk(n, 2)) {
        return 'Quantity must be greater than 0, at most 100000, with at most 2 decimal places.';
      }
      return undefined;
    }
    case 'unit':
      if (!state.unit) return 'Choose a unit.';
      if (categoryMeta && !categoryMeta.allowedUnits.includes(state.unit)) return 'Unit is not valid for this category.';
      return undefined;
    case 'condition':
      if (!state.condition) return 'Choose a condition.';
      return undefined;
    case 'availableFrom': {
      if (state.availableFrom.trim() === '') return 'Available from is required.';
      if (!isIsoDate(state.availableFrom)) return 'Enter a valid date.';
      if (state.availableFrom < today) return 'Available from cannot be in the past.';
      return undefined;
    }
    case 'availableUntil': {
      if (state.availableUntil.trim() === '') return 'Available until is required.';
      if (!isIsoDate(state.availableUntil)) return 'Enter a valid date.';
      if (state.availableFrom && state.availableUntil < state.availableFrom) {
        return 'Available until must be on or after available from.';
      }
      if (state.availableUntil > addDays(today, 90)) {
        return 'Available until must be within 90 days of today.';
      }
      return undefined;
    }
    case 'handoffMode': {
      const modes: readonly string[] = HANDOFF_MODES;
      if (!state.handoffMode || !modes.includes(state.handoffMode)) return 'Choose a handoff option.';
      return undefined;
    }
    case 'description':
      if (state.description.length > 500) return 'Description must be 500 characters or fewer.';
      return undefined;
    case 'referencePriceInr': {
      if (state.referencePriceInr.trim() === '') return undefined;
      const n = Number(state.referencePriceInr);
      if (Number.isNaN(n) || !Number.isInteger(n) || !(n > 0) || n > 100000) {
        return 'Reference price must be a whole number greater than 0 and at most 100000.';
      }
      return undefined;
    }
    default: {
      if (path.startsWith('attributes.')) {
        const key = path.slice('attributes.'.length);
        const field = categoryMeta?.attributeFields.find((f) => f.key === key);
        if (!field) return undefined;
        const raw = state.attributes[key] ?? '';
        if (raw === '') return field.required ? `${field.label} is required.` : undefined;
        if (field.type === 'number') {
          const n = Number(raw);
          if (Number.isNaN(n)) return `${field.label} must be a number.`;
          if (field.min !== undefined && n < field.min) return `${field.label} must be at least ${field.min}.`;
          if (field.max !== undefined && n > field.max) return `${field.label} must be at most ${field.max}.`;
        } else if (field.type === 'boolean') {
          if (raw !== 'true' && raw !== 'false') return `Choose an option for ${field.label.toLowerCase()}.`;
        } else if (field.type === 'text') {
          if (field.maxLength !== undefined && raw.length > field.maxLength) {
            return `${field.label} must be ${field.maxLength} characters or fewer.`;
          }
        }
        return undefined;
      }
      return undefined;
    }
  }
}

/** Full-form pass for submit time. Returns every failing field, keyed by path. */
export function validateAll(
  state: ListingFormState,
  categoryMeta: CategoryMeta | null,
  today: string,
): ListingFormErrors {
  const errors: ListingFormErrors = {};
  for (const path of fieldOrder(categoryMeta)) {
    const message = validateField(path, state, categoryMeta, today);
    if (message) errors[path] = message;
  }
  return errors;
}

function buildAttributesPayload(category: MaterialCategory, categoryMeta: CategoryMeta, state: ListingFormState): MaterialAttributes {
  const attrs: Record<string, unknown> = { category };
  for (const field of categoryMeta.attributeFields) {
    const raw = state.attributes[field.key];
    if (raw === undefined || raw === '') continue;
    if (field.type === 'number') attrs[field.key] = Number(raw);
    else if (field.type === 'boolean') attrs[field.key] = raw === 'true';
    else attrs[field.key] = raw.trim();
  }
  return attrs as unknown as MaterialAttributes;
}

/** Builds the exact POST /v1/listings body. Call only once `validateAll` returns no errors. */
export function buildCreateListingRequest(state: ListingFormState, categoryMeta: CategoryMeta): CreateListingRequest {
  const category = state.category as MaterialCategory;
  const unit = state.unit as Unit;
  const condition = state.condition as Condition;
  return {
    title: state.title.trim(),
    category,
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
    totalQuantity: Number(state.totalQuantity),
    unit,
    condition,
    attributes: buildAttributesPayload(category, categoryMeta, state),
    availableFrom: state.availableFrom,
    availableUntil: state.availableUntil,
    handoffMode: state.handoffMode,
    ...(state.referencePriceInr.trim() ? { referencePriceInr: Number(state.referencePriceInr) } : {}),
  };
}

export function isKnownCategory(value: string): value is MaterialCategory {
  const categories: readonly string[] = MATERIAL_CATEGORIES;
  return categories.includes(value);
}

export function isKnownCondition(value: string): value is Condition {
  const conditions: readonly string[] = CONDITIONS;
  return conditions.includes(value);
}
