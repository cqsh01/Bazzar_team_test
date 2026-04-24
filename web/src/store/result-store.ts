import { create } from 'zustand';
import type { SimulateErrorResponse, SimulateSuccessResponse } from '../types/sim';

export interface ResultStoreState {
  isLoading: boolean;
  error: SimulateErrorResponse | null;
  lastResult: SimulateSuccessResponse | null;
  showDebug: boolean;
  setLoading: () => void;
  setResult: (result: SimulateSuccessResponse) => void;
  setError: (error: SimulateErrorResponse) => void;
  clearResult: () => void;
  toggleDebug: () => void;
}

export const useResultStore = create<ResultStoreState>((set) => ({
  isLoading: false,
  error: null,
  lastResult: null,
  showDebug: false,
  setLoading: () => {
    set({ isLoading: true, error: null, lastResult: null });
  },
  setResult: (result) => {
    set({ isLoading: false, error: null, lastResult: result });
  },
  setError: (error) => {
    set({ isLoading: false, error, lastResult: null });
  },
  clearResult: () => {
    set({ isLoading: false, error: null, lastResult: null });
  },
  toggleDebug: () => {
    set((s) => ({ showDebug: !s.showDebug }));
  },
}));
