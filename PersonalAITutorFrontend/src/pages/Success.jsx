import { useContext, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../auth/AuthContext";

export default function Success() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loadUser } = useContext(AuthContext);

    useEffect(() => {
        const token = searchParams.get("token");

        if (token) {
            localStorage.setItem("access_token", decodeURIComponent(token));
            const syncUserAndProceed = async () => {
                try {
                    await loadUser();
                } finally {
                    navigate("/ai", { replace: true });
                }
            };
            syncUserAndProceed();
        } else {
            navigate("/login", { replace: true });
        }
    }, [searchParams, navigate, loadUser]);

    return (
        <div className="min-h-screen flex items-center justify-center replit-bg px-4">
            <div className="w-full max-w-md replit-panel replit-border replit-rounded-lg p-8 text-center">
                <div className="relative w-10 h-10 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
                    <div className="absolute inset-0 rounded-full border-2 border-t-[#00f0ff] animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Logging you in...</h2>
                <p className="text-zinc-500 text-sm replit-font-mono">Verifying account credentials</p>
            </div>
        </div>
    );
}