import { useContext, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { signup } from "../api/authApi";
import { AuthContext } from "../auth/AuthContext";

export default function Signup() {
    const { user, loading } = useContext(AuthContext);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center replit-bg text-white replit-font-mono text-sm">
                <div className="flex items-center gap-3">
                    <svg className="animate-spin w-4 h-4 text-[#00f0ff]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    if (user) {
        return <Navigate to="/ai" replace />;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            await signup({ name, email, password: pass });
            alert("Signup successful");
            window.location.href = "/login";
        } catch (error) {
            console.error(error.response);
            const errorMessage = error.response?.data?.message || "Signup Failed. Please try again.";
            setError(errorMessage);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 replit-bg">
            <div className="w-full max-w-md replit-panel replit-border replit-rounded-lg p-8">
                <div className="mb-8 text-center">
                    <Link to="/" className="inline-flex items-center gap-1.5 px-3 py-1 replit-rounded border border-[#00f0ff]/20 bg-[#00f0ff]/5 mb-4 hover:border-[#00f0ff]/45 transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                        <span className="text-[10px] text-[#00f0ff] font-semibold tracking-wider uppercase replit-font-mono">← PATHAI HOME</span>
                    </Link>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        Create Your Account
                    </h2>
                </div>

                {error && (
                    <div className="w-full p-3 mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-left replit-rounded replit-font-mono">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider replit-font-mono">Full Name</label>
                        <input
                            className="w-full replit-input px-3.5 py-2.5 text-sm"
                            placeholder="John Doe"
                            value={name}
                            required
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider replit-font-mono">Email Address</label>
                        <input
                            className="w-full replit-input px-3.5 py-2.5 text-sm"
                            placeholder="username@domain.com"
                            value={email}
                            required
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider replit-font-mono">Password</label>
                        <input
                            className="w-full replit-input px-3.5 py-2.5 text-sm"
                            type="password"
                            placeholder="••••••••"
                            value={pass}
                            required
                            onChange={(e) => setPass(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full replit-btn-primary py-2.5 text-sm uppercase tracking-wider replit-font-mono cursor-pointer"
                    >
                        Create Account
                    </button>
                </form>

                <p className="mt-6 text-center text-xs text-zinc-500">
                    Already have an account?{" "}
                    <Link to="/login" className="text-[#00f0ff] hover:underline font-semibold">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    );
}
