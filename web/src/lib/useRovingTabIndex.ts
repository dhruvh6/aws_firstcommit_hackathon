/**
 * Roving-tabindex + arrow-key navigation for a horizontal group of buttons
 * (radiogroup pattern - docs/07-DESIGN-SYSTEM.md § 4 `TilePicker`, and the
 * plain radio groups S4/S5 need alongside it). OWNER: M1.
 *
 * Shared by TilePicker and RadioGroup so the keyboard handling only exists
 * once. Only the *focused* index moves the DOM tabindex; selecting a value
 * is left to the caller (arrow keys move focus, Space/Enter/click select -
 * standard radiogroup behaviour, not "arrow key = select").
 */
import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface RovingTabIndex {
  /** Index that currently has tabindex="0". Pass to each item's tabIndex check. */
  focusedIndex: number;
  /** Ref callback for item `index` - collects the button node for imperative focus. */
  itemRef: (index: number) => (node: HTMLElement | null) => void;
  /** Attach to the group container's onKeyDown. */
  onKeyDown: (event: KeyboardEvent, count: number) => void;
  setFocusedIndex: (index: number) => void;
}

export function useRovingTabIndex(initialIndex = 0): RovingTabIndex {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const nodesRef = useRef<Map<number, HTMLElement>>(new Map());

  const itemRef = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      if (node) nodesRef.current.set(index, node);
      else nodesRef.current.delete(index);
    },
    [],
  );

  const focus = useCallback((index: number) => {
    setFocusedIndex(index);
    nodesRef.current.get(index)?.focus();
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent, count: number) => {
      if (count === 0) return;
      let next: number | null = null;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          next = (focusedIndex + 1) % count;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          next = (focusedIndex - 1 + count) % count;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      focus(next);
    },
    [focusedIndex, focus],
  );

  return { focusedIndex, itemRef, onKeyDown, setFocusedIndex };
}
