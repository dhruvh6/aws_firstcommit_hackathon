/**
 * Fixed "today" for the mock server. OWNER: M1.
 *
 * fixtures/expected-matches.json is computed with today = 2026-09-17 (see its
 * _comment and docs/03-MATCHING-SPEC.md § 8), and every fixture date lives in
 * the 17-30 Sep 2026 window (fixtures/README.md rule 5). Reading the real
 * clock here would silently break every score/urgency calculation and the
 * matching-order fixture the moment this runs on a different day - so, like
 * the real matching engine (docs/03 § "no clock reads"), the mock takes today
 * as a fixed input rather than `new Date()`.
 */
export const MOCK_TODAY = '2026-09-17';
