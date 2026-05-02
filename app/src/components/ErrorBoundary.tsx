// Sprint 23: top-level React error boundary. Catches renderer crashes
// that would otherwise leave the user with a blank window.
//
// When the user has opted into crash reporting (via Settings), the
// error and its component stack are forwarded to the main process via
// the `crash.report` IPC for inclusion in `<userData>/vcd-crash.log`.

import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

type Props = {
  children: ReactNode;
};

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, errorMessage: err.message };
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] caught', err, info);
    if (window.vcd?.crash?.report) {
      window.vcd.crash
        .report({
          name: err.name,
          message: err.message,
          stack: err.stack ?? null,
          componentStack: info.componentStack ?? null,
        })
        .catch(() => {
          /* ignore IPC failure on the crash path */
        });
    }
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="error-boundary">
          <h1>Something went wrong</h1>
          <p>The app caught an unexpected error: {this.state.errorMessage ?? 'unknown'}</p>
          <p>You can reload the window to try again. Your save data is unaffected.</p>
          <button type="button" onClick={this.handleReload}>
            Reload window
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
