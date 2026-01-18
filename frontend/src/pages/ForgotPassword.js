import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="card card-narrow">
        <img src={logo} alt="USLS Logo" className="logo" />
        <h1><center>Forgot Password</center></h1>
        
        {submitted ? (
          <>
            <div className="success" style={{textAlign: 'center'}}>
              <p>✓ Reset link sent!</p>
              <p style={{fontSize: '0.9rem', marginTop: '8px'}}>
                Check your email for instructions to reset your password.
              </p>
            </div>
            <p style={{textAlign: 'center', marginTop: '24px'}}>
              <Link to="/login" className="btn-link">Back to Login</Link>
            </p>
          </>
        ) : (
          <>
            <p className="subtitle" style={{textAlign: 'center'}}>
              Enter your email and we'll send you a link to reset your password.
            </p>

            {error && <p className="error">{error}</p>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p style={{textAlign: 'center', marginTop: '24px'}}>
              <Link to="/login" className="btn-link">Back to Login</Link>
            </p>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}