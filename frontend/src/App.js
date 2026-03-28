import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ActionItemsProvider } from './context/ActionItemsContext';
import { InboxProvider } from './context/InboxContext';
import ThemeToggle from './components/ThemeToggle';
import BirthdayWidget from './components/BirthdayWidget';
import MaintenanceBanner from './components/MaintenanceBanner';
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
import BatchRep from './pages/BatchRep';
import BatchRepVoting from './pages/BatchRepVoting';
import BatchRepVotingModal from './components/BatchRepVotingModal';
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
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="container"><div className="card"><p>{['Hulat!', 'Dali lang gid ha?', 'Wait lang...'][Math.floor(Math.random() * 3)]}</p></div></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Admin-only route wrapper (requires full admin or non-registry permissions)
function FullAdminOnly({ children }) {
  const { user } = useAuth();

  if (!user?.is_super_admin && !user?.hasNonRegistryPermissions) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

// Admin route wrapper (only checks isAdmin flag)
function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return <Navigate to="/profile" replace />;
  }
  return children;
}

// Conditional ThemeToggle - only shown on public pages (not landing, not logged-in)
function ConditionalThemeToggle() {
  const location = useLocation();
  const { user } = useAuth();

  // Hide on landing page (has its own toggle)
  if (location.pathname === '/') {
    return null;
  }

  // Hide when logged in (Navbar has its own toggle)
  if (user) {
    return null;
  }

  // Show on public pages: Login, Forgot Password, Reset Password, Register
  return <ThemeToggle />;
}

// Conditional BirthdayWidget - hidden on landing page and public routes
function ConditionalBirthdayWidget() {
  const location = useLocation();
  const { user } = useAuth();

  // Hide on landing page and when not logged in
  if (location.pathname === '/' || !user) {
    return null;
  }

  return <BirthdayWidget />;
}

// Messenger-safe invite redirect component
// Render rewrites /i/:token to serve index.html, React Router then picks it up here
// and immediately redirects to the actual registration page — same token, same form
function InviteRedirect() {
  const { token } = useParams();
  return <Navigate to={`/register/${token}`} replace />;
}

// Renders the voting modal for eligible users on any page load.
// BatchRepVotingModal is self-contained — it decides internally whether to show.
function VotingModalCheck() {
  const { user } = useAuth();
  // Only mount for logged-in users — modal handles all further access checks
  if (!user) return null;
  return <BatchRepVotingModal />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <VotingModalCheck />
      <Routes>
      {/* Landing: Public marketing page. Access: Anyone. */}
      <Route path="/" element={<Landing />} />

      {/* Invite redirect: Messenger-safe short link that redirects to /register/:token.
          Access: Anyone. Render rewrites /i/:token to index.html, React handles redirect. */}
      <Route path="/i/:token" element={<InviteRedirect />} />

      {/* Register: New user signup with invite token. Access: Anyone with valid token. */}
      <Route path="/register/:token" element={<Register />} />

      {/* Login: User authentication. Access: Unauthenticated only. If logged in → /profile. */}
      <Route path="/login" element={user ? <Navigate to="/profile" replace /> : <Login />} />

      {/* Forgot password: Request password reset email. Access: Anyone. */}
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Reset password: Set new password with reset token. Access: Anyone with valid token. */}
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Funds: Contribution tracking and builder tiers. Access: Super admin OR full admin.
          If unauthorized (registry admin or regular user) → /profile. If not logged in → /login. */}
      <Route
        path="/funds"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <Funds />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Profile: User profile via ProfileWrapper. Access: Any logged-in user. If not logged in → /login.
          ProfileWrapper then routes: Super admin/full admin → /profile-preview (ProfileNew).
          Registry admin/regular user → stays on Profile (old). */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileWrapper />
          </ProtectedRoute>
        }
      />

      {/* Profile Preview (ProfileNew): Enhanced profile with admin features, contribution card, batch rep.
          Access: Super admin OR full admin. If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/profile-preview"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <ProfileNew />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard: Invites, registered users, master list, system tools.
          Access: Any admin (isAdmin flag — includes registry admins). If not admin → /profile. If not logged in → /login. */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Inbox: Announcements and notifications. Access: Super admin OR full admin.
          If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/inbox"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <Inbox />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Events: Upcoming and past events list. Access: Super admin OR full admin.
          If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <Events />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Event Detail: Single event view. Access: Super admin OR full admin.
          If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/events/:id"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <EventDetail />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Media: Photo galleries. Access: Super admin OR full admin.
          If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/media"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <Media />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Committee: Organizing committee members. Access: Super admin OR full admin.
          If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/committee"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <Committee />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Directory: Batchmate search and profiles. Access: Super admin OR full admin.
          If unauthorized → /profile. If not logged in → /login. */}
      <Route
        path="/directory"
        element={
          <ProtectedRoute>
            <FullAdminOnly>
              <Directory />
            </FullAdminOnly>
          </ProtectedRoute>
        }
      />

      {/* Legacy redirect: Old /preview URL redirects to landing for backwards compatibility. */}
      <Route path="/preview" element={<Navigate to="/" replace />} />

      {/* Batch Rep: Batch representative selection. Access: Any logged-in user.
          If not logged in → /login. Phase-based access is controlled within the component. */}
      <Route
        path="/batch-rep"
        element={
          <ProtectedRoute>
            <BatchRep />
          </ProtectedRoute>
        }
      />

      {/* Batch Rep Voting: Round 2 voting page. Access: Any logged-in user.
          If not logged in → /login. Phase-based access + user.id === 71 guard in component. */}
      <Route
        path="/batch-rep-voting"
        element={
          <ProtectedRoute>
            <BatchRepVoting />
          </ProtectedRoute>
        }
      />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <InboxProvider>
          <ActionItemsProvider>
            <BrowserRouter>
              <MaintenanceBanner
                scheduledTime="2026-04-07T09:00:00-07:00"
                durationMinutes={5}
              />
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