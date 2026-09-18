/**
 * OfflineBanner - docs/06-UI-SPEC.md § 3 "Offline / network failure".
 * Uses --warn-050/--warn-700 (not --accent-500) so the amber accent stays
 * reserved for the one primary action per screen (docs/07-DESIGN-SYSTEM.md § 1).
 * OWNER: M1.
 */
import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';

export function OfflineBanner(): React.JSX.Element | null {
  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warn-050 px-4 py-2 text-[13px] font-medium text-warn-700"
    >
      <WifiOff className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      <span>Cannot reach the exchange. Retrying…</span>
    </div>
  );
}
