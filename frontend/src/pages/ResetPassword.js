import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import { api, apiPostPublic } from '../api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Validate token on page load
    api(`/api/auth/reset-password/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setValid(true);
          setEmail(data.email);
        } else {
          setError(data.error || 'Invalid reset link');
        }
      })
      .catch(() => setError('Could not validate reset link'))
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      const res = await apiPostPublic('/api/auth/reset-password', { token, password });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="login-page">
        <div className="container">
          <div className="card card-narrow">
            <p style={{textAlign: 'center'}}>Validating reset link...</p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  if (!valid && !success) {
    return (
      <div className="login-page">
        <div className="container">
          <div className="card card-narrow">
            <img src={logo} alt="USLS Logo" className="logo" />
            <h1><center>Invalid Link</center></h1>
            <p className="error" style={{textAlign: 'center'}}>{error}</p>
            <p style={{textAlign: 'center', marginTop: '16px'}}>
              The reset link may have expired or already been used.
            </p>
            <p style={{textAlign: 'center', marginTop: '24px'}}>
              <Link to="/forgot-password" className="btn-link">Request a new reset link</Link>
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="container">
          <div className="card card-narrow">
            <img src={logo} alt="USLS Logo" className="logo" />
            <h1><center>Password Reset!</center></h1>
            <div className="success" style={{textAlign: 'center'}}>
              <p>✓ Your password has been reset successfully.</p>
            </div>
            <p style={{textAlign: 'center', marginTop: '24px'}}>
              <Link to="/login" className="btn-primary" style={{display: 'inline-block', textDecoration: 'none'}}>
                Go to Login
              </Link>
            </p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="container">
        <div className="card card-narrow">
          <img src={logo} alt="USLS Logo" className="logo" />
          <h1><center>Reset Password</center></h1>
          <p className="subtitle" style={{textAlign: 'center'}}>
            Enter your new password for <strong>{email}</strong>
          </p>

          {error && <p className="error">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <p style={{textAlign: 'center', marginTop: '24px'}}>
            <Link to="/login" className="btn-link">Back to Login</Link>
          </p>
        </div>
        <Footer />
      </div>
    </div>
  );
}