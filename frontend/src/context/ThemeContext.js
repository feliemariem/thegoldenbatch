import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext(null);

// One-time migration: wipe old forced-dark default for users who never explicitly toggled
if (typeof window !== 'undefined') {
  if (localStorage.getItem('theme') === 'dark' && !localStorage.getItem('theme_explicit')) {
    localStorage.removeItem('theme');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'light';
  });

  // Track whether to persist the next theme change
  const shouldPersistRef = useRef(true);

  // Synchronous theme application to prevent flash of wrong theme
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }

  useEffect(() => {
    if (shouldPersistRef.current) {
      localStorage.setItem('theme', theme);
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    // Reset to true for next change
    shouldPersistRef.current = true;
  }, [theme]);

  // setTheme that persists to localStorage (for user toggles)
  const setTheme = (newTheme) => {
    shouldPersistRef.current = true;
    setThemeState(newTheme);
  };

  // setTheme without persisting (for forced page themes)
  const setThemeTemporary = (newTheme) => {
    shouldPersistRef.current = false;
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    localStorage.setItem('theme_explicit', 'true');
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setThemeTemporary, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}