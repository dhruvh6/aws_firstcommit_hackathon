/**
 * AppShell - docs/06-UI-SPEC.md § 3 "Global shell". Landmarks, plus the
 * first-load acting-business gate: until useActingBusiness() is 'ready',
 * render the chrome only - never the Outlet or any business-scoped query -
 * since api/client.ts reads X-Business-Id from localStorage at request
 * time, and nothing downstream may fire that request without one.
 * OWNER: M1.
 */
import { Outlet } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';
import { Toast } from '../components/Toast.js';
import { useActingBusiness } from '../state/actingBusiness.js';
import { Footer } from './Footer.js';
import { OfflineBanner } from './OfflineBanner.js';
import { RouteEffects } from './RouteEffects.js';
import { SecondaryNav } from './SecondaryNav.js';
import { TopBar } from './TopBar.js';

export function AppShell(): React.JSX.Element {
  const acting = useActingBusiness();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-[14px] focus:font-semibold focus:text-brand-700"
      >
        Skip to content
      </a>

      <header>
        <TopBar />
        <SecondaryNav />
      </header>

      <OfflineBanner />

      <main id="main" tabIndex={-1} className="flex-1">
        {acting.status === 'error' ? (
          <div className="mx-auto max-w-[1280px] px-6 py-10">
            <ErrorState message={acting.error.message} onRetry={acting.retry} />
          </div>
        ) : acting.status === 'loading' ? (
          <div className="mx-auto max-w-[1280px] px-6 py-10">
            <Skeleton variant="card" />
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <Footer />
      <Toast />
      <RouteEffects />
    </div>
  );
}
