/**
 * RouteEffects - docs/06-UI-SPEC.md § 3 "Route change": scroll to top and
 * move focus to the page's <h1>, on pathname changes only (not search
 * params), and never on the initial mount.
 * OWNER: M1.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function RouteEffects(): null {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    window.scrollTo(0, 0);

    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.focus();
    } else {
      document.getElementById('main')?.focus();
    }
  }, [pathname]);

  return null;
}
