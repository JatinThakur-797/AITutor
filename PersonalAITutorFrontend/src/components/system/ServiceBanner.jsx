import { useEffect, useState } from "react";
import api from "../../api/axiosClient";

export default function ServiceBanner() {
    const [isDegraded, setIsDegraded] = useState(false);
    const [degradedMessage, setDegradedMessage] = useState("");
    const [retryAction, setRetryAction] = useState(null);

    // Poll GET /health every 20 seconds
    useEffect(() => {
        let mounted = true;

        const checkHealth = async () => {
            try {
                const res = await api.get("/health", { timeout: 4000 });
                if (mounted) {
                    if (res.status === 200) {
                        setIsDegraded(false);
                        setDegradedMessage("");
                    } else {
                        setIsDegraded(true);
                        setDegradedMessage("Service status degraded");
                    }
                }
            } catch (err) {
                // Commented catch:
                // Health probe failed, flag status strip as degraded
                if (mounted) {
                    setIsDegraded(true);
                    setDegradedMessage("Unable to reach backend services");
                }
            }
        };

        checkHealth();
        const interval = setInterval(checkHealth, 20000);

        // Listen for immediate 503 / network error events
        const handleUnavailable = (e) => {
            if (mounted) {
                setIsDegraded(true);
                const sName = e.detail?.service || "service";
                setDegradedMessage(`The ${sName} service is briefly unavailable`);
                if (e.detail?.retry) {
                    setRetryAction(() => e.detail.retry);
                }
            }
        };

        window.addEventListener("app:service-unavailable", handleUnavailable);

        return () => {
            mounted = false;
            clearInterval(interval);
            window.removeEventListener("app:service-unavailable", handleUnavailable);
        };
    }, []);

    const handleManualRetry = async () => {
        if (retryAction) {
            try {
                await retryAction();
                setIsDegraded(false);
                setRetryAction(null);
            } catch (e) {
                // Commented catch:
                // Manual retry attempt remained unsuccessful
            }
        } else {
            setIsDegraded(false);
        }
    };

    if (!isDegraded) return null;

    return (
        <div className="w-full bg-amber-50 border-b border-amber-300 text-amber-900 text-xs px-4 py-2 flex items-center justify-between transition-all">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                <span>
                    {degradedMessage || "One or more services are temporarily degraded. Some actions may take longer."}
                </span>
            </div>
            {retryAction && (
                <button
                    onClick={handleManualRetry}
                    className="ml-4 px-2.5 py-1 text-[11px] font-medium bg-amber-200 hover:bg-amber-300 border border-amber-400 rounded cursor-pointer transition-colors"
                >
                    Retry
                </button>
            )}
        </div>
    );
}
