import type {
  AttributeConstraints,
  Condition,
  Match,
  MatchCheck,
  MaterialAttributes,
  MaterialCategory,
  Requirement,
  SurplusListing,
  Unit,
} from '@dse/shared';
import { CONDITIONS } from '@dse/shared';
import { distanceKm } from './distance.js';

export interface MatchInput {
  requirement: Requirement;
  listings: SurplusListing[];
  today: string;
  includeNearMisses: boolean;
}

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  WOOD_OFFCUTS: 'Wood & plywood offcuts',
  FABRIC_OFFCUTS: 'Fabric offcuts & rolls',
  PACKAGING_CARDBOARD: 'Packaging & cardboard',
  ACRYLIC_SHEET: 'Acrylic & plastic sheet',
};

const UNIT_LABELS: Record<Unit, string> = {
  KG: 'kg',
  UNITS: 'units',
  SHEETS: 'sheets',
  METRES: 'm',
};

const CONDITION_LABELS: Record<Condition, string> = {
  UNUSED: 'Unused',
  CLEAN_USABLE: 'Clean, usable',
  MIXED: 'Mixed',
  NEEDS_SORTING: 'Needs sorting',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function numberText(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function daysBetween(from: string, to: string): number {
  const fromMs = new Date(`${from}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}

function limitDetail(detail: string): string {
  return detail.length <= 90 ? detail : `${detail.slice(0, 89)}…`;
}

function equalsIgnoreCase(a: string | undefined, b: string | undefined): boolean {
  return a?.trim().toLocaleLowerCase() === b?.trim().toLocaleLowerCase();
}

interface AttributeResult {
  passed: boolean;
  detail: string;
}

function attributeResult(successes: string[], failures: string[], empty: string): AttributeResult {
  return failures.length
    ? { passed: false, detail: limitDetail(failures.join('; ')) }
    : { passed: true, detail: limitDetail(successes.length ? successes.join('; ') : empty) };
}

function checkWood(
  attributes: Extract<MaterialAttributes, { category: 'WOOD_OFFCUTS' }>,
  constraints: Extract<AttributeConstraints, { category: 'WOOD_OFFCUTS' }>,
): AttributeResult {
  const successes: string[] = [];
  const failures: string[] = [];
  if (constraints.minPieceSizeCm !== undefined) {
    if (attributes.minPieceSizeCm >= constraints.minPieceSizeCm) {
      successes.push(
        `Smallest piece ${numberText(attributes.minPieceSizeCm)} cm meets your ${numberText(constraints.minPieceSizeCm)} cm minimum`,
      );
    } else {
      failures.push(
        `Smallest piece ${numberText(attributes.minPieceSizeCm)} cm is below your ${numberText(constraints.minPieceSizeCm)} cm minimum`,
      );
    }
  }
  if (constraints.allowTreated === false) {
    if (attributes.treated) failures.push('material is treated');
    else successes.push('untreated as required');
  }
  if (constraints.woodType !== undefined) {
    if (equalsIgnoreCase(attributes.woodType, constraints.woodType)) {
      successes.push(`Wood type ${attributes.woodType} matches`);
    } else if (attributes.woodType === undefined) {
      failures.push('Listing does not state wood type');
    } else {
      failures.push(`Wood type ${attributes.woodType} does not match ${constraints.woodType}`);
    }
  }
  return attributeResult(successes, failures, 'No wood attribute requirements specified');
}

function checkFabric(
  attributes: Extract<MaterialAttributes, { category: 'FABRIC_OFFCUTS' }>,
  constraints: Extract<AttributeConstraints, { category: 'FABRIC_OFFCUTS' }>,
): AttributeResult {
  const successes: string[] = [];
  const failures: string[] = [];
  if (constraints.minPieceLengthCm !== undefined) {
    if (attributes.minPieceLengthCm >= constraints.minPieceLengthCm) {
      successes.push(
        `Shortest piece ${numberText(attributes.minPieceLengthCm)} cm meets your ${numberText(constraints.minPieceLengthCm)} cm minimum`,
      );
    } else {
      failures.push(
        `Shortest piece ${numberText(attributes.minPieceLengthCm)} cm is below your ${numberText(constraints.minPieceLengthCm)} cm minimum`,
      );
    }
  }
  if (constraints.fabricType !== undefined) {
    if (equalsIgnoreCase(attributes.fabricType, constraints.fabricType)) {
      successes.push(`Fabric type ${attributes.fabricType} matches`);
    } else if (attributes.fabricType === undefined) {
      failures.push('Listing does not state fabric type');
    } else {
      failures.push(`Fabric type ${attributes.fabricType} does not match ${constraints.fabricType}`);
    }
  }
  if (constraints.minGsm !== undefined || constraints.maxGsm !== undefined) {
    if (attributes.gsm === undefined) {
      failures.push('Listing does not state GSM');
    } else {
      if (constraints.minGsm !== undefined && attributes.gsm < constraints.minGsm) {
        failures.push(`${numberText(attributes.gsm)} gsm is below your ${numberText(constraints.minGsm)} gsm minimum`);
      }
      if (constraints.maxGsm !== undefined && attributes.gsm > constraints.maxGsm) {
        failures.push(`${numberText(attributes.gsm)} gsm is above your ${numberText(constraints.maxGsm)} gsm maximum`);
      }
      if (
        (constraints.minGsm === undefined || attributes.gsm >= constraints.minGsm)
        && (constraints.maxGsm === undefined || attributes.gsm <= constraints.maxGsm)
      ) successes.push(`${numberText(attributes.gsm)} gsm is within your requested range`);
    }
  }
  return attributeResult(successes, failures, 'No fabric attribute requirements specified');
}

function checkPackaging(
  attributes: Extract<MaterialAttributes, { category: 'PACKAGING_CARDBOARD' }>,
  constraints: Extract<AttributeConstraints, { category: 'PACKAGING_CARDBOARD' }>,
): AttributeResult {
  const successes: string[] = [];
  const failures: string[] = [];
  if (constraints.minPly !== undefined) {
    if (attributes.ply === undefined) failures.push('Listing does not state ply');
    else if (attributes.ply < constraints.minPly) {
      failures.push(`${attributes.ply}-ply is below your ${constraints.minPly}-ply minimum`);
    } else successes.push(`${attributes.ply}-ply meets your ${constraints.minPly}-ply minimum`);
  }
  if (constraints.allowPrinted === false) {
    if (attributes.printed) failures.push('stock is printed');
    else successes.push('unprinted as required');
  }
  return attributeResult(successes, failures, 'No packaging attribute requirements specified');
}

function checkAcrylic(
  attributes: Extract<MaterialAttributes, { category: 'ACRYLIC_SHEET' }>,
  constraints: Extract<AttributeConstraints, { category: 'ACRYLIC_SHEET' }>,
): AttributeResult {
  const successes: string[] = [];
  const failures: string[] = [];
  if (constraints.minThicknessMm !== undefined && attributes.thicknessMm < constraints.minThicknessMm) {
    failures.push(`${numberText(attributes.thicknessMm)} mm is below your ${numberText(constraints.minThicknessMm)} mm minimum`);
  }
  if (constraints.maxThicknessMm !== undefined && attributes.thicknessMm > constraints.maxThicknessMm) {
    failures.push(`${numberText(attributes.thicknessMm)} mm is above your ${numberText(constraints.maxThicknessMm)} mm maximum`);
  }
  if (
    constraints.minThicknessMm !== undefined || constraints.maxThicknessMm !== undefined
  ) {
    if (
      (constraints.minThicknessMm === undefined || attributes.thicknessMm >= constraints.minThicknessMm)
      && (constraints.maxThicknessMm === undefined || attributes.thicknessMm <= constraints.maxThicknessMm)
    ) successes.push(`${numberText(attributes.thicknessMm)} mm thickness is within your requested range`);
  }
  if (constraints.minSheetSizeCm !== undefined) {
    if (attributes.minSheetSizeCm >= constraints.minSheetSizeCm) {
      successes.push(
        `Smallest sheet ${numberText(attributes.minSheetSizeCm)} cm meets your ${numberText(constraints.minSheetSizeCm)} cm minimum`,
      );
    } else {
      failures.push(
        `Smallest sheet ${numberText(attributes.minSheetSizeCm)} cm is below your ${numberText(constraints.minSheetSizeCm)} cm minimum`,
      );
    }
  }
  if (constraints.colour !== undefined) {
    if (equalsIgnoreCase(attributes.colour, constraints.colour)) {
      successes.push(`Colour ${attributes.colour} matches`);
    } else if (attributes.colour === undefined) failures.push('Listing does not state colour');
    else failures.push(`Colour ${attributes.colour} does not match ${constraints.colour}`);
  }
  return attributeResult(successes, failures, 'No acrylic attribute requirements specified');
}

function checkAttributes(listing: SurplusListing, requirement: Requirement): AttributeResult {
  switch (requirement.category) {
    case 'WOOD_OFFCUTS':
      return checkWood(
        listing.attributes as Extract<MaterialAttributes, { category: 'WOOD_OFFCUTS' }>,
        requirement.constraints as Extract<AttributeConstraints, { category: 'WOOD_OFFCUTS' }>,
      );
    case 'FABRIC_OFFCUTS':
      return checkFabric(
        listing.attributes as Extract<MaterialAttributes, { category: 'FABRIC_OFFCUTS' }>,
        requirement.constraints as Extract<AttributeConstraints, { category: 'FABRIC_OFFCUTS' }>,
      );
    case 'PACKAGING_CARDBOARD':
      return checkPackaging(
        listing.attributes as Extract<MaterialAttributes, { category: 'PACKAGING_CARDBOARD' }>,
        requirement.constraints as Extract<AttributeConstraints, { category: 'PACKAGING_CARDBOARD' }>,
      );
    case 'ACRYLIC_SHEET':
      return checkAcrylic(
        listing.attributes as Extract<MaterialAttributes, { category: 'ACRYLIC_SHEET' }>,
        requirement.constraints as Extract<AttributeConstraints, { category: 'ACRYLIC_SHEET' }>,
      );
  }
}

function evaluate(listing: SurplusListing, requirement: Requirement, today: string): Match | null {
  const categoryPassed = listing.category === requirement.category && listing.unit === requirement.unit;
  if (!categoryPassed || listing.businessId === requirement.businessId) return null;

  const remainingRequirement = Math.max(
    0,
    roundQuantity(
      requirement.requestedQuantity
      - requirement.fulfilledQuantity
      - requirement.reservedQuantity,
    ),
  );
  const compatibleQuantity = roundQuantity(
    Math.min(listing.availableQuantity, remainingRequirement),
  );
  const quantityPassed = listing.availableQuantity > 0 && remainingRequirement > 0;
  const attributes = checkAttributes(listing, requirement);
  const conditionPassed = requirement.acceptedConditions.includes(listing.condition);
  const availabilityPassed = listing.availableUntil >= requirement.requiredBy
    && listing.availableFrom <= requirement.requiredBy;
  const kilometres = distanceKm(requirement.location, listing.location);
  const distancePassed = kilometres <= requirement.radiusKm;

  const quantityDetail = remainingRequirement <= 0
    ? 'Your requirement is fully covered by existing reservations'
    : listing.availableQuantity <= 0
      ? 'No quantity currently available on this listing'
      : `${numberText(listing.availableQuantity)} ${UNIT_LABELS[listing.unit]} available, ${numberText(remainingRequirement)} ${UNIT_LABELS[requirement.unit]} needed - ${numberText(compatibleQuantity)} ${UNIT_LABELS[listing.unit]} can be reserved`;

  let availabilityDetail: string;
  if (availabilityPassed) {
    availabilityDetail = `Available until ${shortDate(listing.availableUntil)}, before your ${shortDate(requirement.requiredBy)} deadline`;
  } else if (listing.availableUntil < requirement.requiredBy) {
    const shortage = daysBetween(listing.availableUntil, requirement.requiredBy);
    availabilityDetail = `Available only until ${shortDate(listing.availableUntil)}, your ${shortDate(requirement.requiredBy)} deadline is ${shortage} day${shortage === 1 ? '' : 's'} later`;
  } else {
    availabilityDetail = `Available from ${shortDate(listing.availableFrom)}, after your ${shortDate(requirement.requiredBy)} deadline`;
  }

  const checks: MatchCheck[] = [
    {
      code: 'CATEGORY_COMPATIBLE',
      passed: true,
      detail: `Material category matches: ${CATEGORY_LABELS[listing.category]} (${UNIT_LABELS[listing.unit]})`,
    },
    { code: 'QUANTITY_AVAILABLE', passed: quantityPassed, detail: limitDetail(quantityDetail) },
    { code: 'ATTRIBUTES_SATISFIED', passed: attributes.passed, detail: attributes.detail },
    {
      code: 'CONDITION_ACCEPTED',
      passed: conditionPassed,
      detail: conditionPassed
        ? `Condition "${CONDITION_LABELS[listing.condition]}" is one you accept`
        : `Condition "${CONDITION_LABELS[listing.condition]}" is not in your accepted list`,
    },
    { code: 'AVAILABILITY_WINDOW', passed: availabilityPassed, detail: limitDetail(availabilityDetail) },
    {
      code: 'WITHIN_SERVICE_AREA',
      passed: distancePassed,
      detail: `${numberText(kilometres)} km away, ${distancePassed ? 'inside' : 'outside'} your ${numberText(requirement.radiusKm)} km radius`,
    },
  ];

  const coverage = remainingRequirement > 0
    ? Math.min(1, compatibleQuantity / remainingRequirement)
    : 0;
  const proximity = Math.max(0, 1 - kilometres / requirement.radiusKm);
  const quality = 1 - CONDITIONS.indexOf(listing.condition) / (CONDITIONS.length - 1);
  const urgency = 1 - Math.min(1, Math.max(0, daysBetween(today, listing.availableUntil)) / 14);
  const score = roundScore(
    0.4 * coverage + 0.3 * proximity + 0.2 * quality + 0.1 * urgency,
  );

  return {
    listingId: listing.listingId,
    requirementId: requirement.requirementId,
    compatibleQuantity,
    distanceKm: kilometres,
    score,
    compatible: checks.every((check) => check.passed),
    checks,
    listing: structuredClone(listing),
  };
}

export function findMatches(input: MatchInput): Match[] {
  return input.listings
    .map((listing) => evaluate(listing, input.requirement, input.today))
    .filter((match): match is Match => match !== null)
    .filter((match) => input.includeNearMisses || match.compatible)
    .sort(compareMatches);
}

export function compareMatches(a: Match, b: Match): number {
  if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
  return b.score - a.score
    || a.distanceKm - b.distanceKm
    || a.listing.availableUntil.localeCompare(b.listing.availableUntil)
    || a.listingId.localeCompare(b.listingId);
}
