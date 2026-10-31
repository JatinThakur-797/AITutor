import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../auth/AuthContext";

export default function Landing() {
    const { user, loading } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleGetStarted = () => {
        if (!loading && user) {
            navigate("/ai");
        } else {
            navigate("/login");
        }
    };

    return (
        <div className="min-h-screen bg-[#0e1117] text-zinc-300 flex flex-col">
            {/* Navigation */}
            <nav className="border-b border-[#2e303e] bg-[#1c1e26] px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded flex items-center justify-center bg-[#0f62fe]">
                        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <span className="text-white font-bold text-sm tracking-tight">PathAI</span>
                </div>

                <div className="flex items-center gap-4">
                    {!loading && user ? (
                        <>
                            <span className="text-xs text-zinc-500 replit-font-mono">Logged in as {user.name}</span>
                            <Link to="/ai" className="replit-btn-primary px-4 py-2 text-xs uppercase tracking-wider replit-font-mono">
                                Dashboard
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-xs text-zinc-400 hover:text-white uppercase tracking-wider replit-font-mono transition-colors">
                                Login
                            </Link>
                            <Link to="/signup" className="replit-btn-primary px-4 py-2 text-xs uppercase tracking-wider replit-font-mono">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <header className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 max-w-4xl mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-[#00f0ff]/20 bg-[#00f0ff]/5 mb-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                    <span className="text-[10px] text-[#00f0ff] font-semibold tracking-wider uppercase replit-font-mono">Now in Developer Beta</span>
                </div>
                
                <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-none mb-6">
                    The AI-Powered <br />
                    <span className="text-[#00f0ff]">Developer Tutor</span>
                </h1>
                
                <p className="text-zinc-400 text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
                    Skip generic courses. Provide your career goals and daily study limits to construct a personalized workspace with assessment quizzes, markdown syllabus lessons, and sandbox practice editors.
                </p>

                <div className="flex flex-wrap gap-4 justify-center mb-16">
                    <button
                        onClick={handleGetStarted}
                        className="replit-btn-primary px-8 py-3.5 text-xs font-semibold uppercase tracking-wider replit-font-mono cursor-pointer"
                    >
                        Launch Workspace →
                    </button>
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        className="replit-btn-secondary px-8 py-3.5 text-xs font-semibold uppercase tracking-wider replit-font-mono cursor-pointer flex items-center gap-2"
                    >
                        Star on GitHub
                    </a>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
                    <div className="p-6 rounded border border-[#2e303e] bg-[#1c1e26]">
                        <div className="text-[#00f0ff] text-lg mb-2">⚡</div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider replit-font-mono mb-2">AI Diagnostics</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            Calibrate study levels automatically. Complete a progressive 10-question evaluation check to set your roadmap baseline.
                        </p>
                    </div>

                    <div className="p-6 rounded border border-[#2e303e] bg-[#1c1e26]">
                        <div className="text-[#00f0ff] text-lg mb-2">🗺️</div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider replit-font-mono mb-2">Adaptive Roadmaps</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            Structured chunking paths generated day-by-day. Calibrated directly to match your available study hours.
                        </p>
                    </div>

                    <div className="p-6 rounded border border-[#2e303e] bg-[#1c1e26]">
                        <div className="text-[#00f0ff] text-lg mb-2">💻</div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider replit-font-mono mb-2">Monaco Sandbox</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            Integrated code workspace to validate files and practice tasks without context-switching to local setups.
                        </p>
                    </div>

                    <div className="p-6 rounded border border-[#2e303e] bg-[#1c1e26]">
                        <div className="text-[#00f0ff] text-lg mb-2">💬</div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider replit-font-mono mb-2">AI Coding Assistant</h3>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                            Have questions about a syllabus topic? Consult our floating workspace chat mentor for answers.
                        </p>
                    </div>
                </div>
            </header>

            {/* Footer */}
            <footer className="border-t border-[#2e303e] bg-[#1c1e26] py-6 px-8 text-center">
                <span className="text-[10px] text-zinc-600 replit-font-mono uppercase tracking-wider">
                    PathAI © {new Date().getFullYear()} · Built for developers
                </span>
            </footer>
        </div>
    );
}
