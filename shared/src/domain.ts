/**
 * Entities, enums and state values shared by `web` and `api`.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * SOURCE: docs/02-DOMAIN-MODEL.md §§ 3-8 - transcribe it verbatim, it is FROZEN.
 *
 * This is M2's first Day-1 task and the team's critical blocker: M1 and M3 both
 * import from here. Push it before checkpoint CP1 (docs/09 § 2).
 *
 * Transcribe, in this order:
 *   1. § 3  enums                MATERIAL_CATEGORIES, UNITS, CONDITIONS,
 *                                LISTING_STATUS, REQUIREMENT_STATUS,
 *                                RESERVATION_STATUS, HANDOFF_MODES
 *   2. § 4  Business, GeoPoint
 *   3. § 5  SurplusListing
 *   4. § 6  Requirement
 *   5. § 7  Match, MatchCheck, Reservation, ImpactRecord
 *   6. § 8  MaterialAttributes, AttributeConstraints
 *   7. § 2  MatchCheckCode (the six codes from docs/03 § 2)
 *
 * Field names here are the field names on the wire, in DynamoDB and in the UI.
 * Do not rename anything without a contract change (docs/09 § 3).
 */

export {};
