/**
 * Scaffold placeholder. OWNER: M1.
 *
 * Replace with the global shell + router from docs/06-UI-SPEC.md §§ 2-3.
 * Until then this page exists to prove the toolchain works on every machine and
 * to show whether the API seam is reachable.
 */
import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001/v1';
const USING_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const SCREENS = [
  ['S1', 'Home', '/'],
  ['S2', 'Browse', '/browse'],
  ['S3', 'Listing detail', '/listings/:listingId'],
  ['S4', 'List surplus', '/listings/new'],
  ['S5', 'Post a requirement', '/requirements/new'],
  ['S6', 'Match results', '/requirements/:id/matches'],
  ['S7', 'Reservation review', '/reserve'],
  ['S8', 'My dashboard', '/dashboard'],
  ['S9', 'Reservation detail', '/reservations/:id'],
  ['S10', 'Impact', '/impact'],
] as const;

type Health = 'checking' | 'up' | 'down';

export function App(): React.JSX.Element {
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`)
      .then((r) => { if (!cancelled) setHealth(r.ok ? 'up' : 'down'); })
      .catch(() => { if (!cancelled) setHealth('down'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-[#0f3d91] px-6 py-4 text-white">
        <h1 className="text-xl font-bold">DeadStock Exchange</h1>
        <p className="text-sm text-blue-100">
          B2B circular material exchange for industrial surplus - First Commit 2026
        </p>
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <strong>Scaffold only.</strong> No features are implemented yet. Build order and
          ownership: <code>docs/08-TEAM-ROLES.md</code>. Screens: <code>docs/06-UI-SPEC.md</code>.
        </div>

        <section className="mt-6 rounded-lg border border-gray-300 bg-white p-4">
          <h2 className="font-semibold">Toolchain</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>React + Vite + TypeScript + Tailwind: <span className="font-semibold text-green-700">running</span></li>
            <li>Mocks (MSW): <span className="font-semibold">{USING_MOCKS ? 'enabled' : 'disabled'}</span></li>
            <li>
              API <code>{API_BASE}/health</code>:{' '}
              <span className={health === 'up' ? 'font-semibold text-green-700' : health === 'down' ? 'font-semibold text-red-700' : 'text-gray-600'}>
                {health === 'checking' ? 'checking…' : health === 'up' ? 'reachable' : 'not reachable - run npm run dev:api'}
              </span>
            </li>
          </ul>
        </section>

        <section className="mt-6 rounded-lg border border-gray-300 bg-white p-4">
          <h2 className="font-semibold">Screens to build (docs/06-UI-SPEC.md § 2)</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {SCREENS.map(([id, name, route]) => (
              <li key={id} className="flex gap-3">
                <span className="w-8 shrink-0 font-semibold text-gray-600">{id}</span>
                <span className="w-44 shrink-0">{name}</span>
                <code className="text-gray-600">{route}</code>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
