import { Link } from "react-router-dom";

export default function Error() {
    return (
        <div className="min-h-screen flex items-center justify-center replit-bg px-4">
            <div className="w-full max-w-md replit-panel replit-border replit-rounded-lg p-8 text-center">
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Authentication Failed</h1>
                <p className="text-zinc-500 text-sm mb-6 replit-font-mono">
                    Something went wrong during the authentication process.
                </p>

                <Link
                    to="/login"
                    className="replit-btn-secondary px-6 py-2.5 inline-block text-xs uppercase tracking-wider replit-font-mono"
                >
                    Try Again
                </Link>
            </div>
        </div>
    );
}
