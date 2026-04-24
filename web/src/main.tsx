import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApiStatusBadge, type ApiStatus } from './components/ui/ApiStatusBadge';
import { ConfigPanel } from './components/config/ConfigPanel';
import { ResultSection } from './components/results/ResultSection';
import { ToastViewport } from './components/ui/ToastViewport';
import { ErrorBoundary } from './components/ErrorBoundary';
import { apiClient } from './lib/api-client';

const endpoint = '/api';
apiClient.setEndpoint(endpoint);

function App() {
  const [status, setStatus] = React.useState<ApiStatus>('degraded');
  const [message, setMessage] = React.useState('Checking local bridge...');

  React.useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await apiClient.fetchSchema();
        if (cancelled) return;
        setStatus('online');
        setMessage('Bridge connected. Ready to simulate.');
      } catch (error) {
        if (cancelled) return;
        setStatus(window.PYODIDE_READY ? 'degraded' : 'offline');
        setMessage(error instanceof Error ? error.message : 'Unknown bridge error');
      }
    };

    void boot();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <main
        style={{
          minHeight: '100vh',
          margin: 0,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
          color: '#0f172a',
          padding: '2rem 1rem',
        }}
      >
        <div
          style={{
            maxWidth: '960px',
            margin: '0 auto',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
            display: 'grid',
            gap: '1.5rem',
          }}
        >
          <header>
            <h1 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.75rem' }}>
              The Bazaar Simulator
            </h1>
            <p style={{ color: '#334155', lineHeight: 1.7, margin: '0 0 0.75rem' }}>
              Deterministic combat simulation — configure your loadout and run.
            </p>
            <ApiStatusBadge endpoint={endpoint} mode={__API_MODE__} status={status} />
            {message && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>{message}</p>
            )}
          </header>

          <ConfigPanel />
          <ResultSection />
        </div>
      </main>
      <ToastViewport />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
