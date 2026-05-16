'use client';

/**
 * ErrorBoundary.tsx — React Class-Based Error Boundary
 *
 * Catches runtime JavaScript errors thrown during rendering of any child
 * component tree and reports them to Sentry instead of crashing the entire page.
 *
 * Usage:
 *   <ErrorBoundary context="dashboard-table">
 *     <DataTable ... />
 *   </ErrorBoundary>
 */

import * as Sentry from '@sentry/nextjs';
import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
    children: ReactNode;
    /** Optional custom fallback UI. Defaults to a styled error card. */
    fallback?: ReactNode;
    /** Descriptive label for Sentry context — helps identify which section crashed. */
    context?: string;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Ships the full error + component stack to Sentry
        Sentry.captureException(error, {
            extra: {
                componentStack: info.componentStack,
                context: this.props.context ?? 'unknown',
            },
        });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-red-500/20 bg-red-500/5 text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-red-600">Something went wrong</p>
                        <p className="text-xs text-slate-500 mt-1">
                            This error has been automatically reported to the engineering team.
                        </p>
                    </div>
                    <button
                        className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600 transition-colors"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
