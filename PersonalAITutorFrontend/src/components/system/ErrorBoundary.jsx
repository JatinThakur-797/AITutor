import React from "react";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Commented catch block:
        // Log unexpected component errors in dev for diagnosing boundary trips
        if (typeof console !== "undefined" && console.error) {
            console.error("ErrorBoundary trapped error:", error, errorInfo);
        }
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        } else {
            window.location.reload();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 m-4 rounded border border-stone-300 bg-white text-stone-900 max-w-lg mx-auto text-center shadow-sm">
                    <h2 className="text-base font-semibold mb-2">Something went wrong</h2>
                    <p className="text-sm text-stone-600 mb-4">
                        This section encountered an unexpected error and could not load properly.
                    </p>
                    <button
                        onClick={this.handleReload}
                        className="px-4 py-2 text-xs font-medium rounded border border-teal-700 bg-teal-700 text-white hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Reload section
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
