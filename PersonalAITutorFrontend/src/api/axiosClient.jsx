import axios from "axios";

export class ServiceUnavailableError extends Error {
    constructor(serviceName, message = "Service is temporarily unavailable", originalError = null) {
        super(message);
        this.name = "ServiceUnavailableError";
        this.serviceName = serviceName || "system";
        this.originalError = originalError;
    }
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5050",
    withCredentials: true, // required for HttpOnly refresh cookie
});

// Request Interceptor → Attach access token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("access_token");
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor → Refresh token automatically & map 503/network errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Service Unavailable or Network Error handling
        const is503 = error.response?.status === 503;
        const isNetworkError = !error.response;

        if (is503 || isNetworkError) {
            const serviceName = error.response?.data?.service || "service";
            const retryFn = () => api(originalRequest);

            // Dispatch global event for toast notification with manual retry
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("app:service-unavailable", {
                        detail: {
                            service: serviceName,
                            retry: retryFn,
                        },
                    })
                );
            }

            return Promise.reject(
                new ServiceUnavailableError(
                    serviceName,
                    `The ${serviceName} service is currently unavailable.`,
                    error
                )
            );
        }

        // Token expired case (401)
        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url?.includes("/api/auth/refresh")
        ) {
            originalRequest._retry = true;

            try {
                const res = await api.post("/api/auth/refresh");

                const newToken = res.data.accessToken;
                localStorage.setItem("access_token", newToken);

                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                return api(originalRequest);
            } catch (err) {
                // Commented catch per rule:
                // Handle refresh token failure cleanly by clearing stale token
                localStorage.removeItem("access_token");
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
