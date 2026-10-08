import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// Short messages over the board, e.g. "Too late, that window closed" (spec #2 §8).

export const TOAST_MS = 3800;

interface ToastState {
  toast: { id: number; text: string } | null;
}

export const toasts = createStore<ToastState>()(() => ({ toast: null }));
let nextId = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Show a toast; it replaces the one showing and hides itself after TOAST_MS. */
export function showToast(text: string): void {
  if (timer !== null) clearTimeout(timer);
  const id = ++nextId;
  toasts.setState({ toast: { id, text } });
  timer = setTimeout(() => {
    timer = null;
    if (toasts.getState().toast?.id === id) toasts.setState({ toast: null });
  }, TOAST_MS);
}

export function ToastHost() {
  const toast = useStore(toasts, (s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className="toast" role="status">
      {toast.text}
    </div>
  );
}
