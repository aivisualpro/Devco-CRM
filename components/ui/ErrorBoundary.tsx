import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    resetError = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                const FallbackComponent = this.props.fallback;
                return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
                    <p className="text-red-600 text-center mb-4 max-w-md">
                        An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
                    </p>
                    {this.state.error && (
                        <details className="mb-4 text-sm text-red-700">
                            <summary className="cursor-pointer">Error details</summary>
                            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-w-md">
                                {this.state.error.message}
                            </pre>
                        </details>
                    )}
                    <Button onClick={this.resetError} variant="secondary" className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook version for functional components
export function useErrorHandler() {
    return (error: Error) => {
        console.error('Error caught by useErrorHandler:', error);
        // In a real app, you might want to send this to an error reporting service
        throw error;
    };
}