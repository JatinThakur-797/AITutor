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
        <div className="min-h-screen bg-[#FAFAF9] text-[#1C1917] flex flex-col font-sans">
            {/* Navigation */}
            <nav className="border-b border-[#E7E5E4] bg-white px-8 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-base tracking-tight text-[#1C1917]">PathAI</span>
                </div>

                <div className="flex items-center gap-6">
                    <Link to="/" className="text-sm font-medium text-[#0F766E] pb-1 border-b-2 border-[#0F766E]">
                        Home
                    </Link>
                    {!loading && user ? (
                        <>
                            <span className="text-xs text-[#78716C]">Signed in as {user.name}</span>
                            <Link to="/ai" className="px-3.5 py-1.5 text-xs font-medium rounded bg-[#0F766E] text-white hover:opacity-90 transition-opacity">
                                Workspace
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-sm font-medium text-[#78716C] hover:text-[#1C1917] transition-colors">
                                Log in
                            </Link>
                            <Link to="/signup" className="px-3.5 py-1.5 text-xs font-medium rounded bg-[#0F766E] text-white hover:opacity-90 transition-opacity">
                                Sign up
                            </Link>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <header className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 max-w-4xl mx-auto">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded border border-[#E7E5E4] bg-white mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
                    <span className="text-xs text-[#78716C] font-mono">Developer Beta</span>
                </div>
                
                <h1 className="text-4xl md:text-5xl font-semibold text-[#1C1917] tracking-tight mb-4">
                    The focused AI tutor for developers
                </h1>
                
                <p className="text-[#78716C] text-base md:text-lg max-w-2xl mb-8 leading-relaxed">
                    Set a technical goal and your daily study hours. PathAI calibrates your knowledge with a diagnostic quiz, plans a day-by-day roadmap, and generates interactive lessons with live code execution.
                </p>

                <div className="flex flex-wrap gap-3 justify-center mb-16">
                    <button
                        onClick={handleGetStarted}
                        className="px-6 py-2.5 text-sm font-medium rounded bg-[#0F766E] text-white hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        Launch workspace
                    </button>
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        className="px-6 py-2.5 text-sm font-medium rounded border border-[#E7E5E4] bg-white text-[#1C1917] hover:bg-[#F5F5F4] transition-colors cursor-pointer"
                    >
                        View repository
                    </a>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
                    <div className="p-5 rounded border border-[#E7E5E4] bg-white">
                        <h2 className="text-sm font-semibold text-[#1C1917] mb-1.5">Skill Calibration</h2>
                        <p className="text-[#78716C] text-xs leading-relaxed">
                            Adaptive 10-question evaluations accurately measure baseline proficiency and adjust lesson depth.
                        </p>
                    </div>

                    <div className="p-5 rounded border border-[#E7E5E4] bg-white">
                        <h2 className="text-sm font-semibold text-[#1C1917] mb-1.5">Sequential Roadmaps</h2>
                        <p className="text-[#78716C] text-xs leading-relaxed">
                            Paced, modular daily schedules calculated directly from your target timeline and available study hours.
                        </p>
                    </div>

                    <div className="p-5 rounded border border-[#E7E5E4] bg-white">
                        <h2 className="text-sm font-semibold text-[#1C1917] mb-1.5">Monaco Playground</h2>
                        <p className="text-[#78716C] text-xs leading-relaxed">
                            Practice real problems inside an integrated editor with in-browser execution and syntax checks.
                        </p>
                    </div>

                    <div className="p-5 rounded border border-[#E7E5E4] bg-white">
                        <h2 className="text-sm font-semibold text-[#1C1917] mb-1.5">Contextual AI Mentor</h2>
                        <p className="text-[#78716C] text-xs leading-relaxed">
                            Ask specific questions about any topic or code block right inside your current lesson reader.
                        </p>
                    </div>
                </div>
            </header>

            {/* Footer */}
            <footer className="border-t border-[#E7E5E4] bg-white py-4 px-8 text-center">
                <span className="text-xs text-[#78716C] font-mono">
                    PathAI &middot; Built for developers
                </span>
            </footer>
        </div>
    );
}
