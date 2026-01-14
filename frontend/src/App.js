import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Funds from './pages/Funds';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import './styles/base.css';
import './styles/components.css';
import './styles/auth.css';
import './styles/profile.css';
import './styles/admin.css';
import './styles/landing.css';
import './styles/theme.css';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  
  if (loading) {
    return <div className="container"><div className="card"><p>Loading...</p></div></div>;
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Conditional ThemeToggle - hidden on landing page
function ConditionalThemeToggle() {
  const location = useLocation();
  
  // Don't show on landing page (it has its own toggle in header area)
  if (location.pathname === '/preview') {
    return null;
  }
  
  return <ThemeToggle />;
}

function AppRoutes() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/preview" element={<Landing />} />
      <Route path="/register/:token" element={<Register />} />
      <Route path="/login" element={token ? <Navigate to="/profile" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route
        path="/funds"
        element={
          <ProtectedRoute>
            <Funds />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ConditionalThemeToggle />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;