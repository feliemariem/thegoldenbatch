import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ActionItemsProvider } from './context/ActionItemsContext';
import { InboxProvider } from './context/InboxContext';
import ThemeToggle from './components/ThemeToggle';
import BirthdayWidget from './components/BirthdayWidget';
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Funds from './pages/Funds';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import ProfileWrapper from './pages/ProfileWrapper';
import ProfileNew from './pages/ProfileNew';
import Inbox from './pages/Inbox';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Media from './pages/Media';
import Committee from './pages/Committee';
import Directory from './pages/Directory';
import './styles/base.css';
import './styles/components.css';
import './styles/auth.css';
import './styles/profile.css';
import './styles/admin.css';
import './styles/landing.css';
import './styles/theme.css';
import './styles/footer.css';

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

// Admin-only route wrapper
function AdminOnly({ children }) {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

// Conditional ThemeToggle - hidden on landing page
function ConditionalThemeToggle() {
  const location = useLocation();

  // Landing page is now at "/" instead of "/preview"
  if (location.pathname === '/') {
    return null;
  }

  return <ThemeToggle />;
}

// Conditional BirthdayWidget - hidden on landing page and public routes
function ConditionalBirthdayWidget() {
  const location = useLocation();
  const { token } = useAuth();

  // Hide on landing page and when not logged in
  if (location.pathname === '/' || !token) {
    return null;
  }

  return <BirthdayWidget />;
}

function AppRoutes() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register/:token" element={<Register />} />
      <Route path="/login" element={token ? <Navigate to="/profile" replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route
        path="/funds"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <Funds />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile-preview"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <ProfileNew />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <AdminDashboard />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <Inbox />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <Events />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:id"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <EventDetail />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/media"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <Media />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/committee"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <Committee />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route
        path="/directory"
        element={
          <ProtectedRoute>
            <AdminOnly>
              <Directory />
            </AdminOnly>
          </ProtectedRoute>
        }
      />
      <Route path="/preview" element={<Navigate to="/" replace />} /> {/* Redirect old /preview URL to new landing page for backwards compatibility */}
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <InboxProvider>
          <ActionItemsProvider>
            <BrowserRouter>
              <ConditionalThemeToggle />
              <ConditionalBirthdayWidget />
              <AppRoutes />
            </BrowserRouter>
          </ActionItemsProvider>
        </InboxProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;