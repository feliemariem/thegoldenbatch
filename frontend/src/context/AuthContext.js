import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Check session timeout on load
  useEffect(() => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity && token) {
      const elapsed = Date.now() - parseInt(lastActivity, 10);
      if (elapsed > SESSION_TIMEOUT) {
        // Session expired - clear everything
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('lastActivity');
        setToken(null);
        setLoading(false);
        return;
      }
    }
    // Update activity timestamp
    if (token) {
      localStorage.setItem('lastActivity', Date.now().toString());
    }
  }, []);

  useEffect(() => {
    if (token) {
      // Decode token to check if admin
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.isAdmin) {
          // Admin user - get stored user data or use token data
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          } else {
            setUser({ id: payload.id, email: payload.email, isAdmin: true });
          }
          setLoading(false);
        } else {
          // Regular user - fetch profile
          fetch('https://the-golden-batch-api.onrender.com/api/me', {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => {
              if (res.ok) return res.json();
              throw new Error('Invalid token');
            })
            .then((data) => {
              setUser(data);
            })
            .catch(() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('lastActivity');
              setToken(null);
            })
            .finally(() => setLoading(false));
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('lastActivity');
        setToken(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('lastActivity', Date.now().toString());
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, setUser }}>
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