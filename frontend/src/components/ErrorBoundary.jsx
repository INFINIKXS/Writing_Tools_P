import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught rendering error:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="glass-card p-6 md:p-8 border border-rose-500/30 rounded-3xl bg-slate-100 dark:bg-neutral-950/90 text-center my-6 max-w-2xl mx-auto space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                        <AlertCircle size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">An error occurred while displaying this view</h3>
                    <p className="text-xs text-neutral-400 font-mono bg-black/50 p-3 rounded-xl border border-white/10 text-left overflow-x-auto max-h-32">
                        {this.state.error?.toString() || 'Unknown rendering error'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="btn-accent text-xs py-2.5 px-6 rounded-xl inline-flex items-center gap-2 cursor-pointer"
                    >
                        <RefreshCw size={14} />
                        Reset View
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
