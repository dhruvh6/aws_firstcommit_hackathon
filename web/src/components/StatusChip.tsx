/**
 * StatusChip - docs/07-DESIGN-SYSTEM.md § 4 "Status chip mapping" +
 * "Unknown enum fallback". Colour and text both come from shared/src/labels.ts
 * so a Day-3 enum addition degrades to a neutral chip instead of breaking.
 * OWNER: M1.
 */
import { label, statusChipVariant } from '@dse/shared';
import { Chip } from './Chip.js';

export type StatusChipKind = 'listingStatus' | 'requirementStatus' | 'reservationStatus';

export interface StatusChipProps {
  kind: StatusChipKind;
  status: string;
}

export function StatusChip({ kind, status }: StatusChipProps): React.JSX.Element {
  const variant = statusChipVariant(status);
  const text = label(kind, status) ?? status;
  return <Chip variant={variant}>{text}</Chip>;
}
