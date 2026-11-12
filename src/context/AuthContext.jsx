import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api.js';
import { disconnectRealtime } from '../services/realtime.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/auth/session')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.data.user || null);
        setBackendAvailable(true);
      })
      .catch((error) => {
        if (!active) return;
        setBackendAvailable(error.response?.status !== undefined);
        if (error.response?.status === 401) setUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({
    user,
    checking,
    backendAvailable,
    async login(credentials) {
      const { data } = await api.post('/auth/login', credentials);
      setUser(data.data.user);
      setBackendAvailable(true);
      return data.data.user;
    },
    async register(details) {
      const { data } = await api.post('/auth/register', details);
      setUser(data.data.user);
      setBackendAvailable(true);
      return data.data.user;
    },
    async updateProfile(details) {
      const { data } = await api.patch('/auth/me', details);
      setUser(data.data.user);
      return data.data.user;
    },
    async logout() {
      if (user) await api.post('/auth/logout');
      disconnectRealtime();
      setUser(null);
    },
  }), [user, checking, backendAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
