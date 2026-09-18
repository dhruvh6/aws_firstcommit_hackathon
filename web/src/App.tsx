/**
 * Router + global shell mount. OWNER: M1.
 * Screens: docs/06-UI-SPEC.md § 2. Shell: docs/06-UI-SPEC.md § 3.
 */
import { lazy, Suspense } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Skeleton } from './components/Skeleton.js';
import { AppShell } from './shell/AppShell.js';

const HomePage = lazy(() => import('./pages/HomePage.js').then((m) => ({ default: m.HomePage })));
const BrowsePage = lazy(() => import('./pages/BrowsePage.js').then((m) => ({ default: m.BrowsePage })));
const ListingNewPage = lazy(() =>
  import('./pages/ListingNewPage.js').then((m) => ({ default: m.ListingNewPage })),
);
const ListingDetailPage = lazy(() =>
  import('./pages/ListingDetailPage.js').then((m) => ({ default: m.ListingDetailPage })),
);
const RequirementNewPage = lazy(() =>
  import('./pages/RequirementNewPage.js').then((m) => ({ default: m.RequirementNewPage })),
);
const RequirementMatchesPage = lazy(() =>
  import('./pages/RequirementMatchesPage.js').then((m) => ({ default: m.RequirementMatchesPage })),
);
const ReservePage = lazy(() => import('./pages/ReservePage.js').then((m) => ({ default: m.ReservePage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.js').then((m) => ({ default: m.DashboardPage })),
);
const ReservationDetailPage = lazy(() =>
  import('./pages/ReservationDetailPage.js').then((m) => ({ default: m.ReservationDetailPage })),
);
const ImpactPage = lazy(() => import('./pages/ImpactPage.js').then((m) => ({ default: m.ImpactPage })));
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })),
);
const DevPreviewPage = lazy(() =>
  import('./pages/DevPreviewPage.js').then((m) => ({ default: m.DevPreviewPage })),
);

function PageFallback(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-10">
      <Skeleton variant="card" />
    </div>
  );
}

function withSuspense(element: ReactElement): React.JSX.Element {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={withSuspense(<HomePage />)} />
          <Route path="/browse" element={withSuspense(<BrowsePage />)} />
          <Route path="/listings/new" element={withSuspense(<ListingNewPage />)} />
          <Route path="/listings/:listingId" element={withSuspense(<ListingDetailPage />)} />
          <Route path="/requirements/new" element={withSuspense(<RequirementNewPage />)} />
          <Route path="/requirements/:id/matches" element={withSuspense(<RequirementMatchesPage />)} />
          <Route path="/reserve" element={withSuspense(<ReservePage />)} />
          <Route path="/dashboard" element={withSuspense(<DashboardPage />)} />
          <Route path="/reservations/:id" element={withSuspense(<ReservationDetailPage />)} />
          <Route path="/impact" element={withSuspense(<ImpactPage />)} />
          {import.meta.env.DEV && <Route path="/dev" element={withSuspense(<DevPreviewPage />)} />}
          <Route path="*" element={withSuspense(<NotFoundPage />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
