import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(api.isLoggedIn());

  // On first load, if a token exists, fetch who we are
  useEffect(() => {
    if (!api.isLoggedIn()) return;
    api
      .me()
      .then(setUser)
      .catch(() => api.logout())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (payload) => {
    const res = await api.login(payload);
    setUser(res.user);
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.register(payload);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  // call after anything that changes EXP / avatar
  const refreshUser = useCallback(async () => setUser(await api.me()), []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
