import React from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Best-effort report; never crash harder.
    try {
      console.error('UI error boundary:', error, info);
      if (window.reportError) {
        window.reportError(error);
      }
    } catch {
      /* ignore */
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-icon"><AlertOctagon size={30} /></div>
          <h2>Something went wrong</h2>
          <p>This section hit an unexpected error. Your data is safe — try reloading the page.</p>
          <pre className="detail-pre">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="action-row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={this.handleReset}><RotateCcw size={15} /> Try again</button>
            <button className="btn secondary" onClick={() => window.location.assign('/')}><Home size={15} /> Back home</button>
          </div>
        </div>
      </div>
    );
  }
}
