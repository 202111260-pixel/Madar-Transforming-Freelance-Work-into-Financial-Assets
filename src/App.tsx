import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout';

const LandingPage = lazy(() => import('./LandingPage'));
const AgentRoom = lazy(() => import('./pages/AgentRoom'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const ManualInputPage = lazy(() => import('./pages/ManualInputPage'));
const CreditPanelPage = lazy(() => import('./pages/CreditPanelPage'));
const ActivityLogPage = lazy(() => import('./pages/ActivityLogPage'));

const Loader = () => (
  <div style={{ background: '#0f172a', minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#3b82f6',
    fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, letterSpacing: '0.02em' }}>
    Loading Madar…
  </div>
);

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#111', color: '#f87171', minHeight: '100vh' }}>
          <h2>Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 12 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* ── App pages share a persistent sidebar via AppLayout ── */}
          {/* Connections is the entry portal → then Agent Room → Credit Panel */}
          <Route element={<AppLayout />}>
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/room" element={<AgentRoom />} />
            <Route path="/credit" element={<CreditPanelPage />} />
            <Route path="/manual" element={<ManualInputPage />} />
            <Route path="/activity" element={<ActivityLogPage />} />
            {/* Legacy /consensus redirects to /room */}
            <Route path="/consensus" element={<AgentRoom />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
