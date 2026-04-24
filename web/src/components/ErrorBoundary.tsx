import React from 'react';
import type { CSSProperties, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const CONTAINER: CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
};

const CARD: CSSProperties = {
  maxWidth: 480,
  width: '100%',
  background: '#fff',
  borderRadius: '16px',
  border: '1px solid #fecaca',
  padding: '2rem',
  boxShadow: '0 12px 32px rgba(15,23,42,0.1)',
  display: 'grid',
  gap: '1rem',
  textAlign: 'center',
};

const BTN: CSSProperties = {
  padding: '0.65rem 1.25rem',
  borderRadius: '10px',
  border: 'none',
  fontWeight: 700,
  fontSize: '0.875rem',
  cursor: 'pointer',
  color: '#fff',
  background: '#2563eb',
  justifySelf: 'center',
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.error?.message ?? 'An unexpected error occurred.';
    const isNetworkError =
      message.toLowerCase().includes('fetch') ||
      message.toLowerCase().includes('network') ||
      message.toLowerCase().includes('failed to fetch');

    return (
      <div style={CONTAINER}>
        <div style={CARD} data-testid="error-boundary-fallback">
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#991b1b' }}>
            {isNetworkError ? 'Engine Offline' : 'Something went wrong'}
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {isNetworkError
              ? 'Unable to reach the local simulation engine. Please ensure the FastAPI bridge is running on port 8000.'
              : message}
          </p>
          <code
            style={{
              fontSize: '0.75rem',
              color: '#94a3b8',
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '0.5rem',
              wordBreak: 'break-word',
              textAlign: 'left',
            }}
          >
            {message}
          </code>
          <button type="button" style={BTN} onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }
}
