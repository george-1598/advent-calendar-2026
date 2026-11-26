import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../lib/errorLog';

/** If a screen crashes, show a friendly page (and log it) instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('crash', error.message, `${error.stack ?? ''}\n\nComponents:${info.componentStack ?? ''}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="crash">
        <span className="crash-icon">🎄</span>
        <h1>Oops, an elf tripped over a cable</h1>
        <p>Something went wrong on this page. It’s been reported, and reloading usually fixes it.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button className="crash-home" onClick={() => {
          window.location.hash = '#/';
          window.location.reload();
        }}>
          Back to the calendar
        </button>
      </div>
    );
  }
}
