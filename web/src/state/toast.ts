/**
 * Toast store - docs/06-UI-SPEC.md § 3 "Toasts". Deliberately React-free so
 * non-component code (queryClient.ts's MutationCache.onError) can raise a
 * toast without importing React, and so the push/dismiss logic is trivial
 * to unit test later without a renderer.
 * OWNER: M1.
 */

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
}

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(items);
}

function push(variant: ToastVariant, message: string): string {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  items = [...items, { id, variant, message }];
  emit();
  return id;
}

export function dismissToast(id: string): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToastSnapshot(): ToastItem[] {
  return items;
}

export const toast = {
  success: (message: string): string => push('success', message),
  error: (message: string): string => push('error', message),
  info: (message: string): string => push('info', message),
};
