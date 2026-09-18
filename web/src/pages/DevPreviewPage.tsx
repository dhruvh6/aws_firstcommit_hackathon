/**
 * Scratch preview of the Day 1 component set, reachable at /dev only.
 * Not one of the ten routes in docs/06-UI-SPEC.md § 2 - this page exists so
 * M1 can eyeball every component variant and state in one place. Never link
 * to it from real navigation.
 * OWNER: M1.
 */
import { useState } from 'react';
import { Package, TreePine } from 'lucide-react';
import { Button } from '../components/Button.js';
import { Chip } from '../components/Chip.js';
import { StatusChip } from '../components/StatusChip.js';
import { Input } from '../components/Input.js';
import { Select } from '../components/Select.js';
import { Skeleton } from '../components/Skeleton.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorState } from '../components/ErrorState.js';
import type { ChipVariant } from '../components/Chip.js';
import type { SkeletonVariant } from '../components/Skeleton.js';
import type { ButtonVariant, ButtonSize } from '../components/Button.js';

const CHIP_VARIANTS: ChipVariant[] = ['neutral', 'ok', 'warn', 'danger', 'info'];
const SKELETON_VARIANTS: SkeletonVariant[] = ['card', 'row', 'text', 'tile'];
const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
const BUTTON_SIZES: ButtonSize[] = ['sm', 'md', 'lg'];

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-4 border-b border-ink-200 pb-10">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink-600">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function DevPreviewPage(): React.JSX.Element {
  const [removableChips, setRemovableChips] = useState(['Wood offcuts', 'Clean, usable', '15 km']);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('WOOD_OFFCUTS');

  return (
    <main className="mx-auto flex max-w-[1000px] flex-col gap-10 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Component preview</h1>
        <p className="mt-1 text-[15px] text-ink-600">
          Every Day 1 shared component, every documented variant and state. Hover, active and
          focus-visible states are interactive - tab through or hover the controls below.
        </p>
      </header>

      <Section title="Button">
        {BUTTON_VARIANTS.map((variant) => (
          <Sub key={variant} title={variant}>
            {BUTTON_SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {variant} {size}
              </Button>
            ))}
          </Sub>
        ))}
        <Sub title="fullWidth">
          <div className="w-64">
            <Button fullWidth>Reserve 50 kg</Button>
          </div>
        </Sub>
        <Sub title="loading (width held)">
          <Button loading>Reserve 50 kg</Button>
          <Button variant="secondary" loading>
            Reserve 50 kg
          </Button>
        </Sub>
        <Sub title="disabled">
          <Button disabled>Reserve 50 kg</Button>
          <Button variant="secondary" disabled>
            Reserve 50 kg
          </Button>
          <Button variant="ghost" disabled>
            Reserve 50 kg
          </Button>
          <Button variant="danger" disabled>
            Withdraw listing
          </Button>
        </Sub>
      </Section>

      <Section title="Chip">
        <Sub title="variants">
          {CHIP_VARIANTS.map((variant) => (
            <Chip key={variant} variant={variant}>
              {variant}
            </Chip>
          ))}
        </Sub>
        <Sub title="with leading icon">
          <Chip variant="ok" icon={TreePine}>
            Wood & plywood offcuts
          </Chip>
        </Sub>
        <Sub title="removable (hover to see state)">
          {removableChips.map((chip) => (
            <Chip
              key={chip}
              removable
              onRemove={() => setRemovableChips((prev) => prev.filter((c) => c !== chip))}
            >
              {chip}
            </Chip>
          ))}
          {removableChips.length === 0 && <span className="text-[13px] text-ink-600">All removed.</span>}
        </Sub>
      </Section>

      <Section title="StatusChip">
        <Sub title="listing status">
          <StatusChip kind="listingStatus" status="ACTIVE" />
          <StatusChip kind="listingStatus" status="PARTIALLY_RESERVED" />
          <StatusChip kind="listingStatus" status="FULLY_RESERVED" />
          <StatusChip kind="listingStatus" status="COMPLETED" />
          <StatusChip kind="listingStatus" status="EXPIRED" />
          <StatusChip kind="listingStatus" status="WITHDRAWN" />
        </Sub>
        <Sub title="requirement status">
          <StatusChip kind="requirementStatus" status="OPEN" />
          <StatusChip kind="requirementStatus" status="PARTIALLY_FULFILLED" />
          <StatusChip kind="requirementStatus" status="FULFILLED" />
          <StatusChip kind="requirementStatus" status="CANCELLED" />
        </Sub>
        <Sub title="reservation status">
          <StatusChip kind="reservationStatus" status="RESERVED" />
          <StatusChip kind="reservationStatus" status="HANDED_OFF" />
        </Sub>
        <Sub title="unknown enum value -> neutral chip, raw string, never throws">
          <StatusChip kind="listingStatus" status="ON_BACKORDER" />
        </Sub>
      </Section>

      <Section title="Input">
        <Sub title="default (controlled)">
          <div className="w-72">
            <Input
              label="Title"
              placeholder="Plywood offcuts, clean and dry"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </Sub>
        <Sub title="with helper">
          <div className="w-72">
            <Input label="Minimum usable piece" helper="Leave blank if you don't mind" suffix="cm" />
          </div>
        </Sub>
        <Sub title="required + prefix/suffix">
          <div className="w-72">
            <Input label="Reference price" required prefix="₹" suffix="per kg" />
          </div>
        </Sub>
        <Sub title="error">
          <div className="w-72">
            <Input label="Quantity" suffix="kg" defaultValue={90} type="number" error="Only 80 kg is still available" />
          </div>
        </Sub>
        <Sub title="disabled / readonly">
          <div className="w-72">
            <Input label="Pickup location" disabled defaultValue="Andheri East, Mumbai" />
          </div>
          <div className="w-72">
            <Input label="Pickup location" readOnly defaultValue="Andheri East, Mumbai" />
          </div>
        </Sub>
      </Section>

      <Section title="Select">
        <Sub title="default (controlled)">
          <div className="w-72">
            <Select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'WOOD_OFFCUTS', label: 'Wood & plywood offcuts' },
                { value: 'FABRIC_OFFCUTS', label: 'Fabric offcuts & rolls' },
                { value: 'PACKAGING_CARDBOARD', label: 'Packaging & cardboard' },
                { value: 'ACRYLIC_SHEET', label: 'Acrylic & plastic sheet' },
              ]}
            />
          </div>
        </Sub>
        <Sub title="error">
          <div className="w-72">
            <Select
              label="Unit"
              error="Choose a unit"
              options={[{ value: 'KG', label: 'kg' }, { value: 'UNITS', label: 'units' }]}
            />
          </div>
        </Sub>
        <Sub title="disabled / readonly">
          <div className="w-72">
            <Select
              label="Unit"
              disabled
              options={[{ value: 'KG', label: 'kg' }]}
            />
          </div>
          <div className="w-72">
            <Select
              label="Unit"
              readOnly
              defaultValue="KG"
              options={[{ value: 'KG', label: 'kg' }]}
            />
          </div>
        </Sub>
      </Section>

      <Section title="Skeleton">
        <Sub title="variants (1.2s shimmer, static under prefers-reduced-motion)">
          <div className="flex w-full flex-wrap items-start gap-4">
            {SKELETON_VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-col gap-2">
                <span className="text-[13px] text-ink-600">{variant}</span>
                <div className={variant === 'card' ? 'w-56' : variant === 'row' ? 'w-72' : undefined}>
                  <Skeleton variant={variant} />
                </div>
              </div>
            ))}
          </div>
        </Sub>
      </Section>

      <Section title="EmptyState">
        <Sub title="one CTA">
          <div className="w-full max-w-md">
            <EmptyState
              icon={Package}
              title="No surplus listed yet"
              body="Be the first to list surplus material on the exchange."
              actions={[{ label: 'List surplus material', onClick: () => {}, variant: 'primary' }]}
            />
          </div>
        </Sub>
        <Sub title="two CTAs">
          <div className="w-full max-w-md">
            <EmptyState
              icon={Package}
              title="No listings match these filters"
              body="Try widening your search or relaxing a filter."
              actions={[
                { label: 'Widen to 25 km', onClick: () => {} },
                { label: 'Include "Mixed" condition', onClick: () => {} },
              ]}
            />
          </div>
        </Sub>
      </Section>

      <Section title="ErrorState">
        <Sub title="with code and retry">
          <div className="w-full max-w-md">
            <ErrorState
              message="Cannot reach the exchange. Retrying…"
              code="NETWORK_ERROR"
              onRetry={() => {}}
            />
          </div>
        </Sub>
        <Sub title="message only">
          <div className="w-full max-w-md">
            <ErrorState message="This listing no longer exists." />
          </div>
        </Sub>
      </Section>
    </main>
  );
}
