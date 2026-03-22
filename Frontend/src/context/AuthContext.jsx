import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  const updateAuth = (newToken, newUser) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
    } else {
      localStorage.removeItem('token');
      setToken(null);
    }
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
    } else {
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const login = async (email, password) => {
    try {
      const data = await apiService.login(email, password);
      updateAuth(data.token, data.user);
      return data;
    } catch (err) {
      console.error('[Auth] login failed', {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.baseURL + err?.config?.url
      });
      throw err;
    }
  };

  const register = async (payload) => {
    try {
      const data = await apiService.register(payload);
      updateAuth(data.token, data.user);
      return data;
    } catch (err) {
      console.error('[Auth] register failed', {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        url: err?.config?.baseURL + err?.config?.url
      });
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (err) {
      console.warn('[Auth] logout request failed', err?.message);
    }
    updateAuth(null, null);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiService
      .getMe()
      .then((data) => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch((err) => {
        console.warn('[Auth] getMe failed, clearing session', err?.message, err?.code, err?.response?.status);
        updateAuth(null, null);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth-logout', onLogout);
    return () => window.removeEventListener('auth-logout', onLogout);
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
