import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '2rem', background: 'var(--bg-base, #0a0f1e)',
        flexDirection: 'column', gap: '1.5rem', textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <h1 style={{ color: '#fff', fontWeight: 900, margin: 0, fontSize: '1.4rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, maxWidth: '360px', fontSize: '0.9rem' }}>
          The app hit an unexpected error. Your offline attendance data is safe.
        </p>
        <p style={{
          color: 'rgba(255,0,0,0.6)', background: 'rgba(255,0,0,0.07)',
          borderRadius: '8px', padding: '0.75rem 1rem',
          fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: '400px',
          wordBreak: 'break-word'
        }}>
          {this.state.error?.message || 'Unknown error'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', border: 'none', borderRadius: '12px',
            padding: '0.9rem 2rem', fontWeight: 800, cursor: 'pointer',
            fontSize: '0.95rem', letterSpacing: '0.02em'
          }}
        >
          Reload App
        </button>
      </div>
    );
  }
}
