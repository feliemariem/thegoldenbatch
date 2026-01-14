import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../images/lasalle.jpg';


export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.token, data.user);
      
      // Redirect based on user type
      if (data.user.isAdmin) {
        navigate('/admin');
      } else {
        navigate('/profile');
      }
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
        <h1 style={{textAlign: 'center'}}>University of St. La Salle<br/>HS 2003</h1>
        <p className="subtitle" style={{textAlign: 'center'}}>Welcome back, Batchmate!</p>

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

         <div className="form-group">
          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{textAlign: 'center', marginTop: '16px'}}>
          <Link to="/forgot-password" className="btn-link">Forgot Password?</Link>
        </p>

<p className="help-text">
  Don't have an account? You need an invite link to register.<br />
  Please email <a href="mailto:uslsis.batch2003@gmail.com">uslsis.batch2003@gmail.com</a> for questions.
</p>
      </div>
    </div>
  );
}