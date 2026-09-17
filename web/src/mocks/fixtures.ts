/**
 * Typed access to fixtures/*.json. OWNER: M1.
 *
 * fixtures/ is M4's - read-only from here. These are the only imports of that
 * directory; every handler and the in-memory store goes through this module.
 */
import type { Business, Requirement, SurplusListing } from '@dse/shared';
import type { MetaCategoriesResponse } from '@dse/shared';

import businessesFixture from '../../../fixtures/businesses.json';
import listingsFixture from '../../../fixtures/listings.json';
import requirementsFixture from '../../../fixtures/requirements.json';
import metaCategoriesFixture from '../../../fixtures/meta-categories.json';

export const FIXTURE_BUSINESSES = businessesFixture as unknown as Business[];
export const FIXTURE_LISTINGS = listingsFixture as unknown as SurplusListing[];
export const FIXTURE_REQUIREMENTS = requirementsFixture as unknown as Requirement[];
export const FIXTURE_META_CATEGORIES = metaCategoriesFixture as unknown as MetaCategoriesResponse;
