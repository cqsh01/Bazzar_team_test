/// <reference types="vite/client" />
declare const __API_MODE__: string;
interface ImportMetaEnv { readonly __API_MODE__: string }
interface ImportMeta { readonly env: ImportMetaEnv }
interface Window {
  PYODIDE_READY?: boolean;
  pyodide?: {
    runPythonAsync: (code: string) => Promise<unknown>;
    globals?: {
      set: (name: string, value: unknown) => void;
      get: (name: string) => unknown;
    };
  };
}
