import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Logo } from './Logo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lovemeetly uncaught UI error:', error, errorInfo);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch (e) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  };

  private handleReset = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (e) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-5">
            <Logo size="lg" showText={true} className="justify-center" />
            
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-xs text-stone-400 leading-relaxed">
                Lovemeetly encountered an unexpected issue while rendering. Please click below to refresh and reconnect.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-300 text-xs font-semibold transition cursor-pointer"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
