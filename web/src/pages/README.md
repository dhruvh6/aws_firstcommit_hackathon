# web/src/pages - OWNER: M1

One file per route in docs/06-UI-SPEC.md § 2:

| File | Route | Screen |
|---|---|---|
| `HomePage.tsx` | `/` | S1 |
| `BrowsePage.tsx` | `/browse` | S2 |
| `ListingDetailPage.tsx` | `/listings/:listingId` | S3 |
| `NewListingPage.tsx` | `/listings/new` | S4 |
| `NewRequirementPage.tsx` | `/requirements/new` | S5 |
| `MatchesPage.tsx` | `/requirements/:requirementId/matches` | S6 - the WOW screen |
| `ReservePage.tsx` | `/reserve` | S7 |
| `DashboardPage.tsx` | `/dashboard` | S8 |
| `ReservationDetailPage.tsx` | `/reservations/:reservationId` | S9 |
| `ImpactPage.tsx` | `/impact` | S10 |
| `NotFoundPage.tsx` | `*` | - |

Build order for the demo path: S6 and S7 first, then S2/S3/S4/S5, then S8/S9,
then S1 and S10 last. Filter state lives in the URL, so every page reads its
parameters rather than holding them in component state.
