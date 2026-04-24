import type { SchemaResponse, SimulateRequest, SimulateResponse } from '../types/sim';

declare const __API_MODE__: string;

const DEFAULT_ENDPOINT = '/api';
const SIMULATE_TIMEOUT_MS = 15_000;
const PYODIDE_SIMULATE_SOURCE = `
import json
from minimal_sim_core.api import simulate
_result = simulate(__simulate_payload__)
json.dumps(_result)
`;

export class ApiClient {
  private endpoint: string;

  constructor(initialEndpoint: string = DEFAULT_ENDPOINT) {
    this.endpoint = initialEndpoint;
  }

  setEndpoint(url: string): void {
    this.endpoint = url.replace(/\/$/, '');
  }

  async simulate(config: SimulateRequest): Promise<SimulateResponse> {
    if (this.canUsePyodide()) {
      return this.simulateWithPyodide(config);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SIMULATE_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.endpoint}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: controller.signal,
      });

      const payload = (await response.json()) as SimulateResponse;
      this.assertProtocol(payload);
      return payload;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Simulation timed out after ${SIMULATE_TIMEOUT_MS / 1000}s. The engine may be overloaded — try a shorter duration or fewer items.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchSchema(): Promise<SchemaResponse> {
    const response = await fetch(`${this.endpoint}/schema`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    return (await response.json()) as SchemaResponse;
  }

  private canUsePyodide(): boolean {
    return __API_MODE__ !== 'dev' && window.PYODIDE_READY === true && typeof window.pyodide?.runPythonAsync === 'function';
  }

  private async simulateWithPyodide(config: SimulateRequest): Promise<SimulateResponse> {
    const pyodide = window.pyodide;
    if (!pyodide) {
      throw new Error('Pyodide runtime unavailable.');
    }

    pyodide.globals?.set('__simulate_payload__', config);
    const result = await pyodide.runPythonAsync(PYODIDE_SIMULATE_SOURCE);
    const payload = JSON.parse(String(result)) as SimulateResponse;
    this.assertProtocol(payload);
    return payload;
  }

  private assertProtocol(payload: SimulateResponse): void {
    if (payload.protocol_version !== 'v1.0') {
      throw new Error(`Protocol mismatch: expected v1.0, received ${payload.protocol_version}`);
    }
  }
}

export const apiClient = new ApiClient();
export { SIMULATE_TIMEOUT_MS };
