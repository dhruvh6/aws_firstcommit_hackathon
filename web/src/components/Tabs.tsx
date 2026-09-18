/**
 * Tabs - docs/07-DESIGN-SYSTEM.md § 4 component table: deep-linked to
 * ?tab=, count badges. OWNER: M1.
 *
 * ARIA tabs, automatic activation: arrow keys move focus AND select in one
 * step (the common/simplest tabs pattern), so `tabIndex 0` always tracks
 * whichever tab is selected - including when `value` changes from outside
 * this component (e.g. a nav link setting ?tab= directly). That is why
 * this does not reuse `useRovingTabIndex` (built for TilePicker's
 * radiogroup, where focus and selection are deliberately separate steps).
 *
 * Renders only the tablist. The caller renders its own `role="tabpanel"`
 * per tab, matched via `panelId` - this component derives the tab
 * button's own id as `${panelId}-tab` for `aria-labelledby`/`aria-controls`.
 */
import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  /** Renders a warn-coloured pill instead of a plain "(N)" suffix - the "needs attention" tab. */
  urgent?: boolean;
  panelId: string;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Tabs({ tabs, value, onChange }: TabsProps): React.JSX.Element {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  function selectAndFocus(nextValue: string): void {
    onChange(nextValue);
    buttonRefs.current.get(nextValue)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = tabs[nextIndex];
    if (next) selectAndFocus(next.value);
  }

  return (
    <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-1 border-b border-ink-200">
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(node) => {
              if (node) buttonRefs.current.set(tab.value, node);
              else buttonRefs.current.delete(tab.value);
            }}
            type="button"
            role="tab"
            id={`${tab.panelId}-tab`}
            aria-selected={selected}
            aria-controls={tab.panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => selectAndFocus(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cx(
              'flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[14px] font-medium',
              selected ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-700 hover:bg-ink-050',
            )}
          >
            {tab.label}
            {tab.urgent && (tab.count ?? 0) > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-warn-050 px-1.5 text-[11px] font-semibold text-warn-700">
                {tab.count}
              </span>
            ) : tab.count !== undefined ? (
              <span className="text-ink-600">({tab.count})</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
