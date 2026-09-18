/**
 * Matching engine for the mock server, mirroring api/src/domain/matching.ts as
 * specified in docs/03-MATCHING-SPEC.md. OWNER: M1.
 *
 * Pure functions, no I/O, no clock reads - `today` is always MOCK_TODAY
 * (see ./today.ts). Verified against fixtures/expected-matches.json § 8: the
 * three score components (coverage/proximity/quality/urgency) and the final
 * `score` for req_001 vs lst_001/lst_005/lst_006 match that fixture exactly.
 */
import type {
  AttributeConstraints,
  AttributesFor,
  ConstraintsFor,
  GeoPoint,
  ListingStatus,
  Match,
  MatchCheck,
  MaterialAttributes,
  Requirement,
  SurplusListing,
  Unit,
} from '@dse/shared';
import { CONDITIONS, label } from '@dse/shared';

// ---------------------------------------------------------------------------
// Small numeric/date helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Trims a rounded quantity to a plain display number, e.g. 50.00 -> 50. */
function fmtQty(n: number): string {
  return String(round2(n));
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00.000Z`);
  const to = Date.parse(`${toIso}T00:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Haversine, R = 6371 km - docs/03-MATCHING-SPEC.md § 5, verbatim. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

function unitLabel(unit: Unit): string {
  return label('unit', unit) ?? unit;
}

function categoryLabel(category: string): string {
  return label('category', category) ?? category;
}

// ---------------------------------------------------------------------------
// C3 ATTRIBUTES_SATISFIED - per-category constraint parts (docs/03 § 4)
// ---------------------------------------------------------------------------

interface AttributePart {
  passed: boolean;
  passedText: string;
  failedText: string;
}

function woodParts(attrs: AttributesFor<'WOOD_OFFCUTS'>, cons: ConstraintsFor<'WOOD_OFFCUTS'>): AttributePart[] {
  const parts: AttributePart[] = [];
  if (cons.minPieceSizeCm !== undefined) {
    const passed = attrs.minPieceSizeCm >= cons.minPieceSizeCm;
    parts.push({
      passed,
      passedText: `Smallest piece ${attrs.minPieceSizeCm} cm meets your ${cons.minPieceSizeCm} cm minimum`,
      failedText: `Smallest piece ${attrs.minPieceSizeCm} cm is below your ${cons.minPieceSizeCm} cm minimum`,
    });
  }
  if (cons.allowTreated === false) {
    parts.push({ passed: attrs.treated === false, passedText: 'untreated as required', failedText: 'material is treated' });
  }
  if (cons.woodType !== undefined) {
    const passed = (attrs.woodType ?? '').toLowerCase() === cons.woodType.toLowerCase();
    parts.push({
      passed,
      passedText: `Wood type "${attrs.woodType ?? ''}" matches`,
      failedText: `Wood type "${attrs.woodType ?? 'unspecified'}" does not match your "${cons.woodType}" requirement`,
    });
  }
  return parts;
}

function fabricParts(attrs: AttributesFor<'FABRIC_OFFCUTS'>, cons: ConstraintsFor<'FABRIC_OFFCUTS'>): AttributePart[] {
  const parts: AttributePart[] = [];
  if (cons.minPieceLengthCm !== undefined) {
    const passed = attrs.minPieceLengthCm >= cons.minPieceLengthCm;
    parts.push({
      passed,
      passedText: `Shortest piece ${attrs.minPieceLengthCm} cm meets your ${cons.minPieceLengthCm} cm minimum`,
      failedText: `Shortest piece ${attrs.minPieceLengthCm} cm is below your ${cons.minPieceLengthCm} cm minimum`,
    });
  }
  if (cons.fabricType !== undefined) {
    const passed = (attrs.fabricType ?? '').toLowerCase() === cons.fabricType.toLowerCase();
    parts.push({
      passed,
      passedText: `Fabric type "${attrs.fabricType ?? ''}" matches`,
      failedText: `Fabric type "${attrs.fabricType ?? 'unspecified'}" does not match your "${cons.fabricType}" requirement`,
    });
  }
  if (cons.minGsm !== undefined || cons.maxGsm !== undefined) {
    if (attrs.gsm === undefined) {
      parts.push({ passed: false, passedText: '', failedText: 'Listing does not state GSM' });
    } else {
      const minOk = cons.minGsm === undefined || attrs.gsm >= cons.minGsm;
      const maxOk = cons.maxGsm === undefined || attrs.gsm <= cons.maxGsm;
      parts.push({
        passed: minOk && maxOk,
        passedText: `Weight ${attrs.gsm} gsm is within your required range`,
        failedText: `Weight ${attrs.gsm} gsm is outside your required range`,
      });
    }
  }
  return parts;
}

function packagingParts(
  attrs: AttributesFor<'PACKAGING_CARDBOARD'>,
  cons: ConstraintsFor<'PACKAGING_CARDBOARD'>,
): AttributePart[] {
  const parts: AttributePart[] = [];
  if (cons.minPly !== undefined) {
    if (attrs.ply === undefined) {
      parts.push({ passed: false, passedText: '', failedText: 'Listing does not state ply' });
    } else {
      const passed = attrs.ply >= cons.minPly;
      parts.push({
        passed,
        passedText: `Ply ${attrs.ply} meets your minimum of ${cons.minPly}`,
        failedText: `Ply ${attrs.ply} is below your minimum of ${cons.minPly}`,
      });
    }
  }
  if (cons.allowPrinted === false) {
    parts.push({ passed: attrs.printed === false, passedText: 'unprinted as required', failedText: 'listing is printed' });
  }
  return parts;
}

function acrylicParts(attrs: AttributesFor<'ACRYLIC_SHEET'>, cons: ConstraintsFor<'ACRYLIC_SHEET'>): AttributePart[] {
  const parts: AttributePart[] = [];
  if (cons.minThicknessMm !== undefined || cons.maxThicknessMm !== undefined) {
    const minOk = cons.minThicknessMm === undefined || attrs.thicknessMm >= cons.minThicknessMm;
    const maxOk = cons.maxThicknessMm === undefined || attrs.thicknessMm <= cons.maxThicknessMm;
    parts.push({
      passed: minOk && maxOk,
      passedText: `Thickness ${attrs.thicknessMm} mm is within your required range`,
      failedText: `Thickness ${attrs.thicknessMm} mm is outside your required range`,
    });
  }
  if (cons.minSheetSizeCm !== undefined) {
    const passed = attrs.minSheetSizeCm >= cons.minSheetSizeCm;
    parts.push({
      passed,
      passedText: `Smallest sheet side ${attrs.minSheetSizeCm} cm meets your ${cons.minSheetSizeCm} cm minimum`,
      failedText: `Smallest sheet side ${attrs.minSheetSizeCm} cm is below your ${cons.minSheetSizeCm} cm minimum`,
    });
  }
  if (cons.colour !== undefined) {
    const passed = (attrs.colour ?? '').toLowerCase() === cons.colour.toLowerCase();
    parts.push({
      passed,
      passedText: `Colour "${attrs.colour ?? ''}" matches`,
      failedText: `Colour "${attrs.colour ?? 'unspecified'}" does not match your "${cons.colour}" requirement`,
    });
  }
  return parts;
}

function combineParts(parts: AttributePart[]): { passed: boolean; detail: string } {
  if (parts.length === 0) {
    return { passed: true, detail: 'No dimension or grade requirement specified' };
  }
  const passed = parts.every((p) => p.passed);
  const text = (passed ? parts.map((p) => p.passedText) : parts.filter((p) => !p.passed).map((p) => p.failedText)).join(
    '; ',
  );
  return { passed, detail: text.length > 90 ? `${text.slice(0, 89)}…` : text };
}

function checkAttributes(attributes: MaterialAttributes, constraints: AttributeConstraints): { passed: boolean; detail: string } {
  // C1 has already guaranteed attributes.category === constraints.category.
  switch (constraints.category) {
    case 'WOOD_OFFCUTS':
      return combineParts(woodParts(attributes as AttributesFor<'WOOD_OFFCUTS'>, constraints));
    case 'FABRIC_OFFCUTS':
      return combineParts(fabricParts(attributes as AttributesFor<'FABRIC_OFFCUTS'>, constraints));
    case 'PACKAGING_CARDBOARD':
      return combineParts(packagingParts(attributes as AttributesFor<'PACKAGING_CARDBOARD'>, constraints));
    case 'ACRYLIC_SHEET':
      return combineParts(acrylicParts(attributes as AttributesFor<'ACRYLIC_SHEET'>, constraints));
  }
}

// ---------------------------------------------------------------------------
// Core: evaluate one (listing, requirement) pair - docs/03 § 2, 3, 6
// ---------------------------------------------------------------------------

export interface EvaluatedMatch {
  checks: MatchCheck[];
  compatible: boolean;
  compatibleQuantity: number;
  distanceKm: number;
  score: number;
}

/** Returns null when C1 (the hard gate) fails - such a listing is never returned. */
export function evaluateMatch(listing: SurplusListing, requirement: Requirement, today: string): EvaluatedMatch | null {
  if (listing.category !== requirement.category || listing.unit !== requirement.unit) return null;

  const remainingRequirement = round2(
    requirement.requestedQuantity - requirement.fulfilledQuantity - requirement.reservedQuantity,
  );
  const dist = distanceKm(listing.location, requirement.location);

  const checks: MatchCheck[] = [];

  checks.push({
    code: 'CATEGORY_COMPATIBLE',
    passed: true,
    detail: `Material category matches: ${categoryLabel(listing.category)} (${unitLabel(listing.unit)})`,
  });

  const c2Passed = listing.availableQuantity > 0 && remainingRequirement > 0;
  const compatibleQuantity = c2Passed ? round2(Math.min(listing.availableQuantity, remainingRequirement)) : 0;
  let c2Detail: string;
  if (c2Passed) {
    c2Detail = `${fmtQty(listing.availableQuantity)} ${unitLabel(listing.unit)} available, ${fmtQty(remainingRequirement)} ${unitLabel(listing.unit)} needed - ${fmtQty(compatibleQuantity)} ${unitLabel(listing.unit)} can be reserved`;
  } else if (remainingRequirement <= 0) {
    c2Detail = 'Your requirement is fully covered by existing reservations';
  } else {
    c2Detail = 'No quantity currently available on this listing';
  }
  checks.push({ code: 'QUANTITY_AVAILABLE', passed: c2Passed, detail: c2Detail });

  const c3 = checkAttributes(listing.attributes, requirement.constraints);
  checks.push({ code: 'ATTRIBUTES_SATISFIED', passed: c3.passed, detail: c3.detail });

  const c4Passed = requirement.acceptedConditions.includes(listing.condition);
  const conditionLabel = label('condition', listing.condition) ?? listing.condition;
  checks.push({
    code: 'CONDITION_ACCEPTED',
    passed: c4Passed,
    detail: c4Passed
      ? `Condition "${conditionLabel}" is one you accept`
      : `Condition "${conditionLabel}" is not in your accepted list`,
  });

  const untilOk = listing.availableUntil >= requirement.requiredBy;
  const fromOk = listing.availableFrom <= requirement.requiredBy;
  const c5Passed = untilOk && fromOk;
  let c5Detail: string;
  if (c5Passed) {
    c5Detail = `Available until ${shortDate(listing.availableUntil)}, before your ${shortDate(requirement.requiredBy)} deadline`;
  } else if (!untilOk) {
    const short = daysBetween(listing.availableUntil, requirement.requiredBy);
    c5Detail = `Available only until ${shortDate(listing.availableUntil)}, after your ${shortDate(requirement.requiredBy)} deadline is ${short} day${short === 1 ? '' : 's'} short`;
  } else {
    c5Detail = `Not available until ${shortDate(listing.availableFrom)}, after your ${shortDate(requirement.requiredBy)} deadline`;
  }
  checks.push({ code: 'AVAILABILITY_WINDOW', passed: c5Passed, detail: c5Detail });

  const c6Passed = dist <= requirement.radiusKm;
  checks.push({
    code: 'WITHIN_SERVICE_AREA',
    passed: c6Passed,
    detail: c6Passed
      ? `${dist} km away, inside your ${requirement.radiusKm} km radius`
      : `${dist} km away, outside your ${requirement.radiusKm} km radius`,
  });

  const compatible = checks.every((c) => c.passed);

  const coverage = remainingRequirement > 0 ? Math.min(1, compatibleQuantity / remainingRequirement) : 0;
  const proximity = Math.max(0, 1 - dist / requirement.radiusKm);
  const conditionIndex = CONDITIONS.indexOf(listing.condition);
  const quality = 1 - conditionIndex / (CONDITIONS.length - 1);
  const daysUntilExpiry = daysBetween(today, listing.availableUntil);
  const urgency = 1 - Math.min(1, daysUntilExpiry / 14);
  const score = round4(0.4 * coverage + 0.3 * proximity + 0.2 * quality + 0.1 * urgency);

  return { checks, compatible, compatibleQuantity, distanceKm: dist, score };
}

// ---------------------------------------------------------------------------
// Ranking - docs/03 § 6 tie-breakers
// ---------------------------------------------------------------------------

function rankSort(a: { score: number; distanceKm: number; availableUntil: string; listingId: string }, b: typeof a): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  if (a.availableUntil !== b.availableUntil) return a.availableUntil < b.availableUntil ? -1 : 1;
  return a.listingId < b.listingId ? -1 : a.listingId > b.listingId ? 1 : 0;
}

const NEAR_MISS_CAP = 10;

export interface MatchSetResult<T> {
  compatible: T[];
  nearMisses: T[];
  compatibleCountTotal: number;
  nearMissCountTotal: number;
  truncated: boolean;
}

const OPEN_LISTING_STATUSES: ListingStatus[] = ['ACTIVE', 'PARTIALLY_RESERVED'];

/** Buyer-side: GET /v1/requirements/{id}/matches (docs/04 § 3, the core endpoint). */
export function findMatchesForRequirement(input: {
  requirement: Requirement;
  listings: SurplusListing[];
  today: string;
  includeNearMisses: boolean;
  limit: number;
}): MatchSetResult<Match> {
  const candidates = input.listings.filter(
    (l) => l.businessId !== input.requirement.businessId && OPEN_LISTING_STATUSES.includes(l.status),
  );

  const evaluated = candidates
    .map((listing) => ({ listing, result: evaluateMatch(listing, input.requirement, input.today) }))
    .filter((x): x is { listing: SurplusListing; result: EvaluatedMatch } => x.result !== null);

  const toMatch = (x: { listing: SurplusListing; result: EvaluatedMatch }): Match => ({
    listingId: x.listing.listingId,
    requirementId: input.requirement.requirementId,
    compatibleQuantity: x.result.compatibleQuantity,
    distanceKm: x.result.distanceKm,
    score: x.result.score,
    compatible: x.result.compatible,
    checks: x.result.checks,
    listing: x.listing,
  });

  const rankKey = (m: Match) => ({ score: m.score, distanceKm: m.distanceKm, availableUntil: m.listing.availableUntil, listingId: m.listingId });

  const compatibleAll = evaluated.filter((x) => x.result.compatible).map(toMatch).sort((a, b) => rankSort(rankKey(a), rankKey(b)));
  const nearMissAll = evaluated.filter((x) => !x.result.compatible).map(toMatch).sort((a, b) => rankSort(rankKey(a), rankKey(b)));

  const compatible = compatibleAll.slice(0, input.limit);
  const nearMisses = input.includeNearMisses ? nearMissAll.slice(0, NEAR_MISS_CAP) : [];
  const truncated = compatibleAll.length > input.limit || (input.includeNearMisses && nearMissAll.length > NEAR_MISS_CAP);

  return {
    compatible,
    nearMisses,
    compatibleCountTotal: compatibleAll.length,
    nearMissCountTotal: nearMissAll.length,
    truncated,
  };
}
