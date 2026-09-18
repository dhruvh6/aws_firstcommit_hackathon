/**
 * Category icon slug -> lucide icon, fixed mapping from
 * docs/07-DESIGN-SYSTEM.md § 5. OWNER: M1.
 *
 * `meta.icon` ("wood" | "fabric" | "packaging" | "acrylic") is a server
 * string, not a typed enum, so an icon the frontend has never heard of must
 * degrade to a generic placeholder rather than throw or render nothing -
 * the same "unknown enum -> safe fallback" rule as docs/07 § 4.
 */
import { Layers, Package, Package2, Scissors, TreePine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  wood: TreePine,
  fabric: Scissors,
  packaging: Package2,
  acrylic: Layers,
};

/** Never throws; an unrecognised slug falls back to a generic package icon. */
export function categoryIcon(slug: string): LucideIcon {
  return CATEGORY_ICONS[slug] ?? Package;
}
