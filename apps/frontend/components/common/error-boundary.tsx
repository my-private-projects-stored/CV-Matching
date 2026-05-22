'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { logError } from '@/lib/utils/logger';

interface ErrorBoundaryStrings {
  title: string;
  description: string;
  tryAgain: string;
  reloadPage: string;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  strings?: ErrorBoundaryStrings;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and display a fallback UI.
 * Prevents entire app from crashing when a component throws an error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console (could be sent to error tracking service)
    logError('error-boundary', 'Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const strings: ErrorBoundaryStrings = this.props.strings ?? {
      title: 'Something Went Wrong',
      description: 'An unexpected error occurred. This has been logged for review.',
      tryAgain: 'Try Again',
      reloadPage: 'Reload Page',
    };

    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-[var(--surface-muted)]">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-white p-8 shadow-[0_16px_28px_rgba(15,27,45,0.12)]">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">{strings.title}</h2>
            </div>

            <p className="mb-4 text-sm text-[color:var(--text-muted)]">{strings.description}</p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700 break-all">{this.state.error.message}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={this.handleReset} variant="outline" className="flex-1">
                {strings.tryAgain}
              </Button>
              <Button onClick={this.handleReload} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                {strings.reloadPage}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap any component with an error boundary.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

export function LocalizedErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { t } = useTranslations();
  const strings: ErrorBoundaryStrings = {
    title: t('errors.boundary.title'),
    description: t('errors.boundary.description'),
    tryAgain: t('errors.boundary.tryAgain'),
    reloadPage: t('errors.boundary.reloadPage'),
  };

  return (
    <ErrorBoundary fallback={fallback} strings={strings}>
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
