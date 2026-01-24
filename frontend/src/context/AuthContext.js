import { createContext, useContext, useState, useEffect } from 'react';
import { SESSION_TIMEOUT_MS } from '../config';
import { apiGet, apiPostPublic } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session timeout and verify auth on load
  useEffect(() => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > SESSION_TIMEOUT_MS) {
        // Session expired - clear local data and logout
        localStorage.removeItem('user');
        localStorage.removeItem('lastActivity');
        // Also clear the cookie by calling logout
        apiPostPublic('/api/auth/logout', {}).catch(() => {});
        setLoading(false);
        return;
      }
    }

    // Verify authentication status by calling /api/me
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await apiGet('/api/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
        localStorage.setItem('lastActivity', Date.now().toString());
      } else {
        // Not authenticated or token expired
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('lastActivity');
      }
    } catch {
      // Network error or other issue
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
    } finally {
      setLoading(false);
    }
  };

  const login = (userData) => {
    // Cookie is set by the server, we just store user data locally
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('lastActivity', Date.now().toString());
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiPostPublic('/api/auth/logout', {});
    } catch {
      // Ignore errors, clear local state anyway
    }
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
