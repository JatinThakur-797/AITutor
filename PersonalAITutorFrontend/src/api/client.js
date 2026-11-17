import axios from 'axios';

export const TOKEN_KEY = 'pathai_access_token';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isAuthRequest = ['/api/auth/login', '/api/auth/signup', '/api/auth/refresh', '/api/auth/logout']
      .some((path) => request?.url?.includes(path));

    if (error.response?.status === 401 && request && !request._retry && !isAuthRequest) {
      request._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true, timeout: 20000 })
            .then((response) => {
              const nextToken = response.data?.accessToken;
              if (!nextToken) throw new Error('Refresh response did not contain an access token.');
              localStorage.setItem(TOKEN_KEY, nextToken);
              return nextToken;
            })
            .finally(() => { refreshPromise = null; });
        }
        const token = await refreshPromise;
        request.headers.Authorization = `Bearer ${token}`;
        return api(request);
      } catch (refreshError) {
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new CustomEvent('pathai:session-expired'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (error?.message) return error.message;
  return fallback;
}
