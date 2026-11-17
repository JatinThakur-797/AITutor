import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.profile();
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setBootstrapping(false);
      return undefined;
    }
    authApi.profile()
      .then((profile) => { if (active) setUser(profile); })
      .catch(() => { if (active && !localStorage.getItem(TOKEN_KEY)) setUser(null); })
      .finally(() => { if (active) setBootstrapping(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('pathai:session-expired', onExpired);
    return () => window.removeEventListener('pathai:session-expired', onExpired);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    const profile = response.user || await authApi.profile();
    setUser(profile);
    return profile;
  }, []);

  const register = useCallback(async (details) => {
    await authApi.register(details);
    return login({ email: details.email, password: details.password });
  }, [login]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, bootstrapping, login, register, logout, refreshProfile, setUser }),
    [user, bootstrapping, login, register, logout, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
