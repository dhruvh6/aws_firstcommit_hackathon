/**
 * AllocationBar - docs/07-DESIGN-SYSTEM.md § 4 component table: available /
 * reserved / handed-off, three segments with a 2px white gap between
 * fills, plus a text readout beneath - never a bare percentage.
 * OWNER: M1.
 *
 * Shown only for a listing that has some reserved or handed-off quantity
 * (docs/06 § 5 ListingCard: a fully-`ACTIVE` listing gets no bar - the S8
 * mockup itself only draws one under its `PARTIALLY_RESERVED` row). The
 * caller decides that; this component just draws whatever it's given.
 */
import { formatQuantity } from '../lib/format.js';

export interface AllocationBarProps {
  available: number;
  reserved: number;
  handedOff: number;
  unit: string;
}

export function AllocationBar({ available, reserved, handedOff, unit }: AllocationBarProps): React.JSX.Element {
  const total = available + reserved + handedOff;
  const pct = (value: number): number => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-pill bg-white">
        <div className="bg-ink-300" style={{ width: `${pct(available)}%` }} />
        <div className="bg-warn-700" style={{ width: `${pct(reserved)}%` }} />
        <div className="bg-ok-700" style={{ width: `${pct(handedOff)}%` }} />
      </div>
      <p className="text-[13px] text-ink-600">
        {formatQuantity(available, unit)} available · {formatQuantity(reserved, unit)} reserved ·{' '}
        {formatQuantity(handedOff, unit)} handed off
      </p>
    </div>
  );
}
