import type { Requirement, SurplusListing } from '@dse/shared';

/** Quantities cross the API boundary with at most two decimal places. */
export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function remainingRequirementQuantity(requirement: Requirement): number {
  return Math.max(
    0,
    roundQuantity(
      requirement.requestedQuantity
      - requirement.fulfilledQuantity
      - requirement.reservedQuantity,
    ),
  );
}

export function assertListingQuantityInvariant(listing: SurplusListing): boolean {
  return listing.availableQuantity >= 0
    && listing.reservedQuantity >= 0
    && listing.handedOffQuantity >= 0
    && roundQuantity(
      listing.availableQuantity + listing.reservedQuantity + listing.handedOffQuantity,
    ) === roundQuantity(listing.totalQuantity);
}
