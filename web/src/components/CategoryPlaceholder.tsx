/**
 * CategoryPlaceholder - docs/07-DESIGN-SYSTEM.md § 8 "Placeholder imagery".
 * A 4:3 box tinted with the category's categorical-palette slot colour,
 * carrying a drawn illustration of the material (MaterialArtwork) and the
 * category's fixed icon (§ 5) as a corner marker.
 *
 * Still no stock photography and no generated images: every pixel is SVG we
 * drew, so there is no licence to credit and nothing to fetch over the network
 * mid-recording. OWNER: M1; artwork added by M4.
 *
 * `MaterialCategory` is a closed, frozen four-value union (shared/src/domain.ts)
 * with a permanently fixed icon per docs/07 § 5, unlike a server-driven enum
 * such as `status` - so mapping it here (with a safe fallback) does not
 * reintroduce the hardcoded-taxonomy problem docs/06 § 7 warns about.
 */
import { Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MaterialCategory } from '@dse/shared';
import { categoryIcon } from '../lib/categoryIcon.js';
import { MaterialArtwork } from './MaterialArtwork.js';

export interface CategoryPlaceholderProps {
  category: MaterialCategory;
  className?: string;
}

const CATEGORY_SLUG: Record<MaterialCategory, string> = {
  WOOD_OFFCUTS: 'wood',
  FABRIC_OFFCUTS: 'fabric',
  PACKAGING_CARDBOARD: 'packaging',
  ACRYLIC_SHEET: 'acrylic',
};

const TINT_CLASS: Record<string, string> = {
  wood: 'bg-category-wood/12',
  fabric: 'bg-category-fabric/12',
  packaging: 'bg-category-packaging/12',
  acrylic: 'bg-category-acrylic/12',
};

const ICON_CLASS: Record<string, string> = {
  wood: 'text-category-wood/30',
  fabric: 'text-category-fabric/30',
  packaging: 'text-category-packaging/30',
  acrylic: 'text-category-acrylic/30',
};

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function CategoryPlaceholder({ category, className }: CategoryPlaceholderProps): React.JSX.Element {
  const slug = CATEGORY_SLUG[category] ?? 'wood';
  const Icon: LucideIcon = categoryIcon(slug) ?? Package;

  return (
    <div
      aria-hidden="true"
      className={cx(
        'relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md',
        TINT_CLASS[slug] ?? 'bg-ink-100',
        className,
      )}
    >
      <MaterialArtwork category={category} className="absolute inset-0 h-full w-full" />
      {/* The icon stays as a small corner marker: the artwork shows the
          material, the icon keeps the category's fixed visual identity
          (docs/07 § 5) legible even at rail size. */}
      <Icon
        className={cx('absolute bottom-2 right-2 h-5 w-5', ICON_CLASS[slug] ?? 'text-ink-300')}
        strokeWidth={2}
      />
    </div>
  );
}
