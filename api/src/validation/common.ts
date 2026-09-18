import { validationError } from '../errors.js';

export type JsonObject = Record<string, unknown>;

export function requireObject(value: unknown, field = 'body'): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    validationError(field, `${field === 'body' ? 'Request body' : field} must be an object.`);
  }
  return value as JsonObject;
}

export function rejectUnknownKeys(
  value: JsonObject,
  allowed: readonly string[],
  fieldPrefix = '',
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unknown) {
    const field = fieldPrefix ? `${fieldPrefix}.${unknown}` : unknown;
    validationError(field, `Unknown field: ${field}.`);
  }
}

export function requiredString(
  value: unknown,
  field: string,
  minimumLength: number,
  maximumLength: number,
): string {
  if (typeof value !== 'string') validationError(field, `${field} is required.`);
  const normalized = value.trim();
  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    validationError(field, `${field} must be ${minimumLength}-${maximumLength} characters.`);
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  field: string,
  maximumLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') validationError(field, `${field} must be text.`);
  const normalized = value.trim();
  if (normalized.length > maximumLength) {
    validationError(field, `${field} must be at most ${maximumLength} characters.`);
  }
  return normalized || undefined;
}

export function numberInRange(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  options: { integer?: boolean; maximumDecimals?: number } = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    validationError(field, `${field} must be a number.`);
  }
  if (value < minimum || value > maximum) {
    validationError(field, `${field} must be between ${minimum} and ${maximum}.`);
  }
  if (options.integer && !Number.isInteger(value)) {
    validationError(field, `${field} must be a whole number.`);
  }
  if (options.maximumDecimals !== undefined) {
    const rounded = Math.round(value * 10 ** options.maximumDecimals) / 10 ** options.maximumDecimals;
    if (Math.abs(value - rounded) > Number.EPSILON) {
      validationError(field, `${field} must have at most ${options.maximumDecimals} decimal places.`);
    }
    return rounded;
  }
  return value;
}

export function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') validationError(field, `${field} must be true or false.`);
  return value;
}

export function enumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    validationError(field, `${field} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isIsoDate(value)) {
    validationError(field, `${field} must be a valid date in YYYY-MM-DD format.`);
  }
  return value;
}

export function addUtcDays(isoDateValue: string, days: number): string {
  const date = new Date(`${isoDateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
