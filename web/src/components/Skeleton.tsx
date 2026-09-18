/**
 * Skeleton - docs/07-DESIGN-SYSTEM.md § 4 component table + § 6 motion
 * (1.2 s shimmer, static under prefers-reduced-motion).
 * OWNER: M1.
 */
export type SkeletonVariant = 'card' | 'row' | 'text' | 'tile';

export interface SkeletonProps {
  variant: SkeletonVariant;
  className?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const VARIANT_CLASSES: Record<SkeletonVariant, string> = {
  card: 'h-64 w-full rounded-lg',
  row: 'h-14 w-full rounded-md',
  text: 'h-4 w-full rounded-sm',
  tile: 'h-24 w-24 rounded-lg',
};

export function Skeleton({ variant, className }: SkeletonProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'bg-ink-200 motion-safe:animate-[pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none',
        VARIANT_CLASSES[variant],
        className,
      )}
    />
  );
}
