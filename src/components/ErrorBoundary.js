import { Component } from 'react';

// Catches render-time errors in the routed page tree so a single bad page can't
// white-screen the whole app. The nav shell stays mounted (this wraps only the
// routes), so the user can navigate away. React 19 still requires a class
// component for componentDidCatch.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Route render error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="max-w-md w-full border border-white/8 bg-zinc-card/40 p-6 text-center space-y-4">
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-red-destructive font-mono">
              ▸ Something broke
            </p>
            <p className="text-sm text-white/65 leading-snug">
              This page hit an error. Your data is safe — try again, or head back home.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Try again
                </span>
              </button>
              <a
                href="/"
                className="px-4 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/30 transition-colors duration-150"
              >
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Go home
                </span>
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
