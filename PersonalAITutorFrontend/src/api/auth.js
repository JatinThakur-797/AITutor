import { api, API_BASE_URL, TOKEN_KEY } from './client';

export const authApi = {
  async login(payload) {
    const { data } = await api.post('/api/auth/login', payload);
    if (!data?.accessToken) throw new Error('Login response did not contain an access token.');
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    return data;
  },
  async register(payload) {
    const { data } = await api.post('/api/auth/signup', payload);
    return data;
  },
  async profile() {
    const { data } = await api.get('/api/user/profile');
    return data;
  },
  async logout() {
    try { await api.post('/api/auth/logout'); } finally { localStorage.removeItem(TOKEN_KEY); }
  },
  oauthUrl(provider) {
    return `${API_BASE_URL}/oauth2/authorization/${provider}`;
  },
};
