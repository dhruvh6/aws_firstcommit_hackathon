/**
 * MaterialArtwork - illustrated stand-ins for listing photography, one per
 * material category. OWNER: M4 (built on 19 September so the marketplace
 * surfaces stop looking like wireframes).
 *
 * WHY DRAWN RATHER THAN PHOTOGRAPHED (docs/07-DESIGN-SYSTEM.md § 8)
 * ----------------------------------------------------------------
 * The competition rules require every third-party asset to be licensed and
 * credited. Stock photography would add a licence obligation, an attribution
 * list and - if hotlinked - a live network dependency that can fail in the
 * middle of a three-minute recording. These are inline SVG: ours, licence-free,
 * offline-safe, and crisp at any size.
 *
 * COLOUR NOTE
 * -----------
 * The category tint uses the validated categorical slot colour, which encodes
 * *identity* (docs/07 § 7). The artwork inside uses realistic material colours
 * instead, because a blue plank or a green carton reads as a diagram rather
 * than as material. Identity still comes through the tinted surround and the
 * slot-coloured baseline.
 */
import type { MaterialCategory } from '@dse/shared';

export interface MaterialArtworkProps {
  category: MaterialCategory;
  className?: string;
}

/** Shared frame so every illustration sits on the same 4:3 canvas. */
function Frame({ children, tint }: { children: React.ReactNode; tint: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 400 300" role="presentation" aria-hidden="true" className="h-full w-full">
      <rect width="400" height="300" fill={tint} />
      {children}
    </svg>
  );
}

function WoodOffcuts(): React.JSX.Element {
  return (
    <Frame tint="#f4ece1">
      {/* back plank */}
      <g transform="rotate(-7 200 150)">
        <rect x="58" y="96" width="250" height="44" rx="3" fill="#b98a55" />
        <rect x="58" y="96" width="250" height="8" rx="3" fill="#cda071" />
        <path d="M74 118h218M74 128h180" stroke="#a5763f" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      </g>
      {/* middle plank */}
      <g transform="rotate(4 200 150)">
        <rect x="74" y="140" width="268" height="46" rx="3" fill="#d2a173" />
        <rect x="74" y="140" width="268" height="8" rx="3" fill="#e2b98f" />
        <path d="M92 162h232M92 173h150" stroke="#b98a55" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      </g>
      {/* front offcut blocks */}
      <g transform="rotate(-3 200 150)">
        <rect x="96" y="188" width="96" height="40" rx="3" fill="#c08f57" />
        <rect x="96" y="188" width="96" height="7" rx="3" fill="#d6a978" />
        <rect x="200" y="188" width="70" height="40" rx="3" fill="#ab7c46" />
        <rect x="200" y="188" width="70" height="7" rx="3" fill="#c49463" />
      </g>
      {/* end grain */}
      <g transform="translate(286 196)">
        <rect width="46" height="34" rx="3" fill="#e0bb91" />
        <ellipse cx="23" cy="17" rx="14" ry="10" fill="none" stroke="#b98a55" strokeWidth="2" />
        <ellipse cx="23" cy="17" rx="7" ry="5" fill="none" stroke="#b98a55" strokeWidth="2" />
      </g>
      <rect x="0" y="252" width="400" height="48" fill="#2a78d6" opacity=".10" />
    </Frame>
  );
}

function FabricOffcuts(): React.JSX.Element {
  return (
    <Frame tint="#fbeee7">
      {/* folded bolt, back */}
      <path d="M60 176c40-26 84-26 124 0s84 26 124 0v42c-40 26-84 26-124 0s-84-26-124 0z" fill="#d8674a" opacity=".85" />
      {/* middle drape */}
      <path d="M52 152c44-30 92-30 136 0s92 30 136 0v34c-44 30-92 30-136 0s-92-30-136 0z" fill="#eb8a63" />
      {/* front drape with stitch line */}
      <path d="M68 206c38-22 80-22 118 0s80 22 118 0v30c-38 22-80 22-118 0s-80-22-118 0z" fill="#c2543c" />
      <path
        d="M74 214c38-20 80-20 118 0s80 20 118 0"
        fill="none"
        stroke="#fbeee7"
        strokeWidth="2.5"
        strokeDasharray="7 7"
        strokeLinecap="round"
        opacity=".9"
      />
      {/* rolled offcut */}
      <g transform="translate(272 96)">
        <rect width="72" height="46" rx="23" fill="#e8a184" />
        <ellipse cx="23" cy="23" rx="12" ry="20" fill="#d8674a" />
        <ellipse cx="23" cy="23" rx="5" ry="9" fill="#fbeee7" opacity=".8" />
      </g>
      {/* small swatches */}
      <rect x="66" y="104" width="52" height="40" rx="4" fill="#eb8a63" transform="rotate(-8 92 124)" />
      <rect x="126" y="110" width="44" height="36" rx="4" fill="#c2543c" transform="rotate(6 148 128)" />
      <rect x="0" y="252" width="400" height="48" fill="#eb6834" opacity=".10" />
    </Frame>
  );
}

function PackagingCardboard(): React.JSX.Element {
  return (
    <Frame tint="#f6efe3">
      {/* back flat-packed sheets */}
      <g transform="rotate(-5 200 150)">
        <rect x="70" y="92" width="240" height="30" rx="2" fill="#c79a63" />
        <path d="M70 107q6-8 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12 0"
          fill="none" stroke="#a87c48" strokeWidth="1.6" opacity=".55" />
      </g>
      {/* assembled carton */}
      <g>
        <path d="M120 150l80-26 80 26v78l-80 26-80-26z" fill="#d6a86e" />
        <path d="M200 124l80 26-80 26-80-26z" fill="#e4bd8a" />
        <path d="M200 176v78l80-26v-78z" fill="#bd8f55" />
        {/* tape */}
        <path d="M200 124l-26 8 26 8 26-8z" fill="#f2e3c8" opacity=".9" />
        <path d="M200 176v78" stroke="#a87c48" strokeWidth="2" opacity=".5" />
      </g>
      {/* flute edge detail on a loose sheet */}
      <g transform="translate(272 196) rotate(9)">
        <rect width="86" height="40" rx="2" fill="#e4bd8a" />
        <path d="M0 12q5-8 10 0t10 0 10 0 10 0 10 0 10 0 10 0 10 0 10 0" fill="none" stroke="#a87c48" strokeWidth="1.8" opacity=".7" />
        <path d="M0 28q5-8 10 0t10 0 10 0 10 0 10 0 10 0 10 0 10 0 10 0" fill="none" stroke="#a87c48" strokeWidth="1.8" opacity=".5" />
      </g>
      <rect x="0" y="252" width="400" height="48" fill="#1baf7a" opacity=".10" />
    </Frame>
  );
}

function AcrylicSheet(): React.JSX.Element {
  return (
    <Frame tint="#eef4f6">
      {/* stacked translucent sheets */}
      <g>
        <rect x="70" y="112" width="200" height="120" rx="4" fill="#9fc8d6" opacity=".55" transform="rotate(-8 170 172)" />
        <rect x="104" y="96" width="200" height="120" rx="4" fill="#7fb8ca" opacity=".55" transform="rotate(4 204 156)" />
        <rect x="128" y="132" width="180" height="108" rx="4" fill="#bcdde6" opacity=".7" transform="rotate(-3 218 186)" />
      </g>
      {/* visible cut edges */}
      <g opacity=".8">
        <rect x="128" y="132" width="180" height="108" rx="4" fill="none" stroke="#5f9fb4" strokeWidth="2.5" transform="rotate(-3 218 186)" />
        <rect x="104" y="96" width="200" height="120" rx="4" fill="none" stroke="#5f9fb4" strokeWidth="2" opacity=".6" transform="rotate(4 204 156)" />
      </g>
      {/* gloss streaks */}
      <g opacity=".75">
        <path d="M150 208l58-70" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
        <path d="M182 214l34-42" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity=".8" />
      </g>
      {/* offcut corner piece */}
      <rect x="286" y="182" width="62" height="54" rx="3" fill="#cfe6ed" stroke="#5f9fb4" strokeWidth="2" transform="rotate(11 317 209)" />
      <rect x="0" y="252" width="400" height="48" fill="#eda100" opacity=".10" />
    </Frame>
  );
}

const ARTWORK: Record<MaterialCategory, () => React.JSX.Element> = {
  WOOD_OFFCUTS: WoodOffcuts,
  FABRIC_OFFCUTS: FabricOffcuts,
  PACKAGING_CARDBOARD: PackagingCardboard,
  ACRYLIC_SHEET: AcrylicSheet,
};

export function MaterialArtwork({ category, className }: MaterialArtworkProps): React.JSX.Element {
  const Art = ARTWORK[category] ?? WoodOffcuts;
  return (
    <div aria-hidden="true" className={`overflow-hidden ${className ?? ''}`}>
      <Art />
    </div>
  );
}
