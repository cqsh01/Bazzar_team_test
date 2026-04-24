import { create } from 'zustand';

export type ToastLevel = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  level: ToastLevel;
  message: string;
}

interface ToastStoreState {
  toasts: ToastItem[];
  pushToast: (level: ToastLevel, message: string, durationMs?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_TOAST_MS = 2600;

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  pushToast: (level, message, durationMs = DEFAULT_TOAST_MS) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, level, message }],
    }));

    window.setTimeout(() => {
      get().removeToast(id);
    }, durationMs);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));
