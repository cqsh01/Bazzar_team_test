import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigPanel } from '../src/components/config/ConfigPanel';
import { ToastViewport } from '../src/components/ui/ToastViewport';
import { exportConfigAsJson, importConfigFromJson, INVALID_CONFIG_JSON, UNSUPPORTED_SCHEMA_VERSION } from '../src/lib/persistence';
import { apiClient } from '../src/lib/api-client';
import { configStoreStorageKey, DEFAULT_SIMULATE_REQUEST, ECHO_HIGHLIGHT_MS, SAVE_DEBOUNCE_MS, useConfigStore } from '../src/store/config-store';
import { useToastStore } from '../src/store/toast-store';
import type { SimulateRequest, SimulateSuccessResponse } from '../src/types/sim';

function resetStore(config?: SimulateRequest): void {
  useConfigStore.setState({
    config: config ?? (JSON.parse(JSON.stringify(DEFAULT_SIMULATE_REQUEST)) as SimulateRequest),
    lastSavedAt: null,
    highlightedPaths: [],
  });
  useToastStore.getState().clearToasts();
}

function makeJsonFile(text: string, name = 'config.json'): File {
  const file = new File([text], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: async () => text,
  });
  return file;
}

function renderWithToast(node: React.ReactElement) {
  return render(
    <>
      {node}
      <ToastViewport />
    </>,
  );
}

describe('Phase 5.4 persistence flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();
    resetStore();
  });

  it('auto-updates localStorage after form edits', async () => {
    renderWithToast(<ConfigPanel />);

    const input = screen.getByLabelText(/Unit ID/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hero' } });

    await act(async () => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 20);
    });

    const raw = window.localStorage.getItem(configStoreStorageKey);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).unit_config.unit_id).toBe('hero');
  });

  it('restores config from localStorage on reload', () => {
    const saved: SimulateRequest = {
      ...DEFAULT_SIMULATE_REQUEST,
      unit_config: {
        ...DEFAULT_SIMULATE_REQUEST.unit_config,
        unit_id: 'restored-hero',
        base_attack_cooldown: 2.5,
      },
    };
    window.localStorage.setItem(configStoreStorageKey, JSON.stringify(saved));

    useConfigStore.getState().loadFromLocalStorage();

    expect(useConfigStore.getState().config.unit_config.unit_id).toBe('restored-hero');
    expect(useConfigStore.getState().config.unit_config.base_attack_cooldown).toBe(2.5);
  });

  it('exported JSON contains __meta_version v1', () => {
    const OriginalBlob = globalThis.Blob;
    let capturedText = '';

    class BlobMock {
      parts: unknown[];
      type: string;

      constructor(parts: unknown[], options?: { type?: string }) {
        this.parts = parts;
        this.type = options?.type ?? '';
        capturedText = String(parts[0] ?? '');
      }
    }

    Object.defineProperty(globalThis, 'Blob', {
      value: BlobMock,
      configurable: true,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });

    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          click,
          set href(_value: string) {},
          set download(_value: string) {},
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    exportConfigAsJson(DEFAULT_SIMULATE_REQUEST);

    expect(capturedText).toContain('"__meta_version": "v1"');
    expect(click).toHaveBeenCalled();

    createElement.mockRestore();
    Object.defineProperty(globalThis, 'Blob', {
      value: OriginalBlob,
      configurable: true,
    });
  });

  it('rejects corrupted JSON on import', async () => {
    const file = makeJsonFile('not json', 'broken.json');
    await expect(importConfigFromJson(file)).rejects.toMatchObject({ code: INVALID_CONFIG_JSON });
  });

  it('rejects unsupported schema version on import', async () => {
    const file = makeJsonFile(JSON.stringify({ __meta_version: 'legacy_v0', ...DEFAULT_SIMULATE_REQUEST }), 'legacy.json');
    await expect(importConfigFromJson(file)).rejects.toMatchObject({ code: UNSUPPORTED_SCHEMA_VERSION });
  });

  it('forces input_echo sync and removes highlight after 2s', async () => {
    vi.useRealTimers();
    const simulateMock = vi.spyOn(apiClient, 'simulate');

    const success: SimulateSuccessResponse = {
      protocol_version: 'v1.0',
      status: 'success',
      data: {
        summary: {
          total_damage: 1,
          dps: 1,
          per_owner_damage: { hero: 1 },
          event_count: 1,
          attack_count: 1,
          periodic_damage_total: 0,
          periodic_tick_count: 0,
        },
        charts: [],
        input_echo: {
          ...DEFAULT_SIMULATE_REQUEST,
          unit_config: {
            ...DEFAULT_SIMULATE_REQUEST.unit_config,
            unit_id: 'echo-hero',
            base_attack_cooldown: 2.0,
          },
        },
      },
    };

    simulateMock.mockResolvedValue(success);
    resetStore({
      ...DEFAULT_SIMULATE_REQUEST,
      unit_config: {
        ...DEFAULT_SIMULATE_REQUEST.unit_config,
        unit_id: 'raw-hero',
        base_attack_cooldown: 1.0,
      },
    });

    renderWithToast(<ConfigPanel />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-simulation'));
    });

    await waitFor(() => {
      expect(useConfigStore.getState().config.unit_config.unit_id).toBe('echo-hero');
      expect(useConfigStore.getState().config.unit_config.base_attack_cooldown).toBe(2.0);
    });

    expect(screen.getByTestId('toast-info')).toHaveTextContent('配置已按引擎规则标准化');

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, ECHO_HIGHLIGHT_MS + 50));
    });

    await waitFor(() => {
      expect(useConfigStore.getState().highlightedPaths).toEqual([]);
    });

    simulateMock.mockRestore();
  }, 8000);

  it('save on route leave flushes immediately', () => {
    useConfigStore.getState().replaceConfig({
      ...DEFAULT_SIMULATE_REQUEST,
      unit_config: { ...DEFAULT_SIMULATE_REQUEST.unit_config, unit_id: 'leave-save' },
    });

    renderWithToast(<ConfigPanel />);
    fireEvent(window, new Event('beforeunload'));

    const raw = window.localStorage.getItem(configStoreStorageKey);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).unit_config.unit_id).toBe('leave-save');
  });
});
