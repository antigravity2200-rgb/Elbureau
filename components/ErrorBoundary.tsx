import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    state = { hasError: false, error: null };


    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 20, color: 'red', fontFamily: 'monospace', backgroundColor: '#fff', height: '100vh', width: '100vw', zIndex: 9999, position: 'fixed' }}>
                    <h1 className="text-2xl font-bold">Application Crashed</h1>
                    <p className="mt-4 font-bold">{this.state.error?.toString()}</p>
                    <pre className="mt-2 text-sm bg-gray-100 p-4 border rounded overflow-auto max-h-[500px]">
                        {this.state.error?.stack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded font-bold"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
