/**
 * Client-side mirror of docs/04-API-CONTRACT.md § 3 `POST /v1/requirements`
 * validation table, driven by the live `CategoryMeta` from
 * GET /v1/meta/categories so it can never hardcode a per-category field
 * list. This is a convenience only - the server remains the authority
 * (docs/06 § 7) - but the field paths here MUST match the server's
 * `error.field` strings exactly, because both drive the same
 * `fieldId()` -> input-id lookup. OWNER: M1.
 */
import type { AttributeConstraints, CategoryMeta, CreateRequirementRequest, Unit } from '@dse/shared';
import { MATERIAL_CATEGORIES } from '@dse/shared';
import type { Condition, MaterialCategory } from '@dse/shared';

export interface RequirementFormState {
  category: MaterialCategory | null;
  requestedQuantity: string;
  unit: Unit | null;
  requiredBy: string;
  acceptedConditions: string[];
  /**
   * Raw values keyed by constraint key. Every constraint is optional; a
   * blank raw value ('') means "no preference" and is OMITTED from the
   * request body - never sent as '', 0 or false. Booleans are
   * '' | 'true' | 'false', where '' is the explicit "no preference" state
   * (docs/03-MATCHING-SPEC.md § 4: an absent constraint is not a constraint).
   */
  constraints: Record<string, string>;
  radiusKm: string;
  notes: string;
}

export const INITIAL_REQUIREMENT_FORM: RequirementFormState = {
  category: null,
  requestedQuantity: '',
  unit: null,
  requiredBy: '',
  acceptedConditions: [],
  constraints: {},
  radiusKm: '15',
  notes: '',
};

export const RADIUS_OPTIONS = ['15', '25', '50'] as const;

/** Every field path this form can produce, in server-table order (docs/04 § 3). */
export function fieldOrder(categoryMeta: CategoryMeta | null): string[] {
  const constraintKeys = categoryMeta ? categoryMeta.constraintFields.map((f) => `constraints.${f.key}`) : [];
  return [
    'category',
    'requestedQuantity',
    'unit',
    'acceptedConditions',
    ...constraintKeys,
    'radiusKm',
    'requiredBy',
    'notes',
  ];
}

/** `constraints.minPieceSizeCm` -> `field-constraints-minPieceSizeCm`, matching the server's `error.field`. */
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

export type RequirementFormErrors = Record<string, string>;

/**
 * Validates one field at a time (for on-blur checks) - see `validateAll` for
 * the submit-time pass. `today` is the real current date (ISO), never
 * mocks/today.ts's fixed clock.
 */
export function validateField(
  path: string,
  state: RequirementFormState,
  categoryMeta: CategoryMeta | null,
  today: string,
): string | undefined {
  switch (path) {
    case 'category':
      if (!state.category) return 'Choose a category.';
      return undefined;
    case 'requestedQuantity': {
      if (state.requestedQuantity.trim() === '') return 'Quantity is required.';
      const n = Number(state.requestedQuantity);
      if (Number.isNaN(n) || !(n > 0) || n > 100000 || !decimalsOk(n, 2)) {
        return 'Quantity must be greater than 0, at most 100000, with at most 2 decimal places.';
      }
      return undefined;
    }
    case 'unit':
      if (!state.unit) return 'Choose a unit.';
      if (categoryMeta && !categoryMeta.allowedUnits.includes(state.unit)) return 'Unit is not valid for this category.';
      return undefined;
    case 'acceptedConditions':
      if (state.acceptedConditions.length === 0) return 'Choose at least one accepted condition.';
      return undefined;
    case 'radiusKm': {
      const allowed: readonly string[] = RADIUS_OPTIONS;
      if (!allowed.includes(state.radiusKm)) return 'Choose a search radius.';
      return undefined;
    }
    case 'requiredBy': {
      if (state.requiredBy.trim() === '') return 'Needed by is required.';
      if (!isIsoDate(state.requiredBy)) return 'Enter a valid date.';
      if (state.requiredBy < today) return 'Needed by cannot be in the past.';
      if (state.requiredBy > addDays(today, 90)) return 'Needed by must be within 90 days of today.';
      return undefined;
    }
    case 'notes':
      if (state.notes.length > 500) return 'Notes must be 500 characters or fewer.';
      return undefined;
    default: {
      if (path.startsWith('constraints.')) {
        const key = path.slice('constraints.'.length);
        const field = categoryMeta?.constraintFields.find((f) => f.key === key);
        if (!field) return undefined;
        const raw = state.constraints[key] ?? '';
        // Every constraint is optional: a blank raw value is always valid,
        // regardless of the field's own `required` flag (docs/06 § 8).
        if (raw === '') return undefined;
        if (field.type === 'number') {
          const n = Number(raw);
          if (Number.isNaN(n)) return `${field.label} must be a number.`;
          if (field.min !== undefined && n < field.min) return `${field.label} must be at least ${field.min}.`;
          if (field.max !== undefined && n > field.max) return `${field.label} must be at most ${field.max}.`;
        } else if (field.type === 'text') {
          if (field.maxLength !== undefined && raw.length > field.maxLength) {
            return `${field.label} must be ${field.maxLength} characters or fewer.`;
          }
        }
        // boolean: '' | 'true' | 'false' are the only reachable values from
        // the tri-state RadioGroup, all valid - nothing further to check.
        return undefined;
      }
      return undefined;
    }
  }
}

/** Full-form pass for submit time. Returns every failing field, keyed by path. */
export function validateAll(
  state: RequirementFormState,
  categoryMeta: CategoryMeta | null,
  today: string,
): RequirementFormErrors {
  const errors: RequirementFormErrors = {};
  for (const path of fieldOrder(categoryMeta)) {
    const message = validateField(path, state, categoryMeta, today);
    if (message) errors[path] = message;
  }
  return errors;
}

function buildConstraintsPayload(
  category: MaterialCategory,
  categoryMeta: CategoryMeta,
  state: RequirementFormState,
): AttributeConstraints {
  const constraints: Record<string, unknown> = { category };
  for (const field of categoryMeta.constraintFields) {
    const raw = state.constraints[field.key];
    if (raw === undefined || raw === '') continue;
    if (field.type === 'number') constraints[field.key] = Number(raw);
    else if (field.type === 'boolean') constraints[field.key] = raw === 'true';
    else constraints[field.key] = raw.trim();
  }
  return constraints as unknown as AttributeConstraints;
}

/** Builds the exact POST /v1/requirements body. Call only once `validateAll` returns no errors. */
export function buildCreateRequirementRequest(
  state: RequirementFormState,
  categoryMeta: CategoryMeta,
): CreateRequirementRequest {
  const category = state.category as MaterialCategory;
  const unit = state.unit as Unit;
  return {
    category,
    requestedQuantity: Number(state.requestedQuantity),
    unit,
    acceptedConditions: state.acceptedConditions as Condition[],
    constraints: buildConstraintsPayload(category, categoryMeta, state),
    radiusKm: Number(state.radiusKm),
    requiredBy: state.requiredBy,
    ...(state.notes.trim() ? { notes: state.notes.trim() } : {}),
  };
}

export function isKnownCategory(value: string): value is MaterialCategory {
  const categories: readonly string[] = MATERIAL_CATEGORIES;
  return categories.includes(value);
}
