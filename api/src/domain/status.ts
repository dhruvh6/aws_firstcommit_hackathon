import type {
  ListingStatus,
  Requirement,
  RequirementStatus,
  SurplusListing,
} from '@dse/shared';
import { roundQuantity } from './quantity.js';

/** Pure status derivation from docs/02 § 9. */
export function deriveListingStatus(
  listing: SurplusListing,
  today: string,
): ListingStatus {
  if (listing.status === 'WITHDRAWN') return 'WITHDRAWN';
  if (roundQuantity(listing.handedOffQuantity) === roundQuantity(listing.totalQuantity)) {
    return 'COMPLETED';
  }
  if (listing.availableUntil < today && listing.availableQuantity > 0) return 'EXPIRED';
  if (roundQuantity(listing.availableQuantity) === 0) return 'FULLY_RESERVED';
  if (listing.reservedQuantity > 0 || listing.handedOffQuantity > 0) {
    return 'PARTIALLY_RESERVED';
  }
  return 'ACTIVE';
}

export function deriveRequirementStatus(
  requirement: Requirement,
  today: string,
): RequirementStatus {
  if (requirement.status === 'CANCELLED') return 'CANCELLED';
  if (requirement.fulfilledQuantity >= requirement.requestedQuantity) return 'FULFILLED';
  if (requirement.requiredBy < today) return 'EXPIRED';
  if (requirement.reservedQuantity > 0 || requirement.fulfilledQuantity > 0) {
    return 'PARTIALLY_FULFILLED';
  }
  return 'OPEN';
}
