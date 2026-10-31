import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5050",
    withCredentials: true, // required for HttpOnly refresh cookie
});

// Request Interceptor → Attach access token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("access_token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor → Refresh token automatically
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Token expired case
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const res = await api.post("/api/auth/refresh");

                const newToken = res.data.accessToken;
                localStorage.setItem("access_token", newToken);

                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                return api(originalRequest);
            } catch (err) {
                localStorage.removeItem("access_token");
                window.location.href = "/login";
                return Promise.reject(err);
            }
        }

        // Network / server issue
        if (!error.response) {
            console.error("Server Offline or CORS Issue");
            
        }

        return Promise.reject(error);
    }
);

export default api;
