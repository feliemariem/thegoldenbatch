import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';

export default function Register() {
  const { token: inviteToken } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [validating, setValidating] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(1); // 1: password, 2: disclaimer, 3: form
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    birthday: '',
    mobile: '',
    address: '',
    city: '',
    country: '',
    occupation: '',
    company: '',
    rsvp: '',
  });

  useEffect(() => {
    // Validate invite token
    fetch(`https://the-golden-batch-api.onrender.com/api/invites/${inviteToken}/validate`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setEmail(data.email);
          // Pre-fill names if available
          if (data.first_name || data.last_name) {
            setForm(prev => ({
              ...prev,
              first_name: data.first_name || '',
              last_name: data.last_name || ''
            }));
          }
        } else {
          setError(data.error || 'Invalid invite link');
        }
      })
      .catch(() => setError('Could not validate invite'))
      .finally(() => setValidating(false));
  }, [inviteToken]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setStep(2); // Go to disclaimer
  };

  const handleAcceptDisclaimer = () => {
    setStep(3); // Go to form
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.rsvp) {
      setError('Please select if you are attending');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_token: inviteToken,
          ...form,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      login(data.token, data.user);
      navigate('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="login-page">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="container">
          <div className="card">
            <p>Validating your invite...</p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  if (error && !email) {
    return (
      <div className="login-page">
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="container">
          <div className="card">
            <h1>Invalid Invite</h1>
            <p className="error">{error}</p>
            <p>Please contact the organizer for a valid invite link.</p>
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <button
        onClick={toggleTheme}
        className="theme-toggle"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="container">
        <div className="card">
          <img src={logo} alt="USLS Logo" className="logo" />
          <h1 className="page-title-gold">
            University of St. La Salle<br />IS 2003
          </h1>
          <p className="email-display">Hi Batchmate! Please register using: <strong>{email}</strong></p>

        {error && <p className="error">{error}</p>}

        {/* Step 1: Password Creation */}
        {step === 1 && (
          <form onSubmit={handlePasswordSubmit}>
           <div className="form-group">
              <label>Create Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              <label>Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary">
              Continue
            </button>
          </form>
        )}

        {/* Step 2: Disclaimer */}
        {step === 2 && (
          <div className="disclaimer-step">
            <div className="disclaimer-box">
              <h3>Why We're Collecting Your Information</h3>
              <p>
                The information you provide will be used solely for the purpose of organizing 
                our alumni homecoming event. This includes:
              </p>
              <ul>
                <li>Contacting you with event updates and announcements</li>
                <li>Creating a batch directory to help classmates reconnect</li>
                <li>Planning event logistics based on attendance</li>
              </ul>
              <p>
                Your personal information will only be shared with fellow batch members and 
                the organizing committee. We will not share your data with any third parties 
                or use it for commercial purposes.
              </p>
              <p>
                You may request to update or remove your information at any time by contacting 
                the organizing committee.
              </p>
            </div>

            <div className="button-row disclaimer-buttons">
              <button onClick={() => setStep(1)} className="btn-secondary">
                Back
              </button>
              <button onClick={handleAcceptDisclaimer} className="btn-primary">
                I Understand, Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Contact Information Form */}
        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <div className="step-indicator">
              <span>Almost done! Fill out your contact information.</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Birthday</label>
                <input
                  type="date"
                  name="birthday"
                  value={form.birthday}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Mobile</label>
                <input
                  type="tel"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  placeholder="+63 917 123 4567"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Address (optional)</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Street, Barangay"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Country *</label>
                <select
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Country</option>
                  <option value="Philippines">Philippines</option>
                  <option disabled>──────────</option>
                  <option value="Afghanistan">Afghanistan</option>
                  <option value="Albania">Albania</option>
                  <option value="Algeria">Algeria</option>
                  <option value="Andorra">Andorra</option>
                  <option value="Angola">Angola</option>
                  <option value="Argentina">Argentina</option>
                  <option value="Armenia">Armenia</option>
                  <option value="Australia">Australia</option>
                  <option value="Austria">Austria</option>
                  <option value="Azerbaijan">Azerbaijan</option>
                  <option value="Bahrain">Bahrain</option>
                  <option value="Bangladesh">Bangladesh</option>
                  <option value="Belarus">Belarus</option>
                  <option value="Belgium">Belgium</option>
                  <option value="Belize">Belize</option>
                  <option value="Bhutan">Bhutan</option>
                  <option value="Bolivia">Bolivia</option>
                  <option value="Bosnia and Herzegovina">Bosnia and Herzegovina</option>
                  <option value="Brazil">Brazil</option>
                  <option value="Brunei">Brunei</option>
                  <option value="Bulgaria">Bulgaria</option>
                  <option value="Cambodia">Cambodia</option>
                  <option value="Cameroon">Cameroon</option>
                  <option value="Canada">Canada</option>
                  <option value="Chile">Chile</option>
                  <option value="China">China</option>
                  <option value="Colombia">Colombia</option>
                  <option value="Costa Rica">Costa Rica</option>
                  <option value="Croatia">Croatia</option>
                  <option value="Cuba">Cuba</option>
                  <option value="Cyprus">Cyprus</option>
                  <option value="Czech Republic">Czech Republic</option>
                  <option value="Denmark">Denmark</option>
                  <option value="Dominican Republic">Dominican Republic</option>
                  <option value="Ecuador">Ecuador</option>
                  <option value="Egypt">Egypt</option>
                  <option value="El Salvador">El Salvador</option>
                  <option value="Estonia">Estonia</option>
                  <option value="Ethiopia">Ethiopia</option>
                  <option value="Finland">Finland</option>
                  <option value="France">France</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Germany">Germany</option>
                  <option value="Ghana">Ghana</option>
                  <option value="Greece">Greece</option>
                  <option value="Guatemala">Guatemala</option>
                  <option value="Honduras">Honduras</option>
                  <option value="Hong Kong">Hong Kong</option>
                  <option value="Hungary">Hungary</option>
                  <option value="Iceland">Iceland</option>
                  <option value="India">India</option>
                  <option value="Indonesia">Indonesia</option>
                  <option value="Iran">Iran</option>
                  <option value="Iraq">Iraq</option>
                  <option value="Ireland">Ireland</option>
                  <option value="Israel">Israel</option>
                  <option value="Italy">Italy</option>
                  <option value="Jamaica">Jamaica</option>
                  <option value="Japan">Japan</option>
                  <option value="Jordan">Jordan</option>
                  <option value="Kazakhstan">Kazakhstan</option>
                  <option value="Kenya">Kenya</option>
                  <option value="Kuwait">Kuwait</option>
                  <option value="Laos">Laos</option>
                  <option value="Latvia">Latvia</option>
                  <option value="Lebanon">Lebanon</option>
                  <option value="Libya">Libya</option>
                  <option value="Lithuania">Lithuania</option>
                  <option value="Luxembourg">Luxembourg</option>
                  <option value="Macau">Macau</option>
                  <option value="Malaysia">Malaysia</option>
                  <option value="Maldives">Maldives</option>
                  <option value="Malta">Malta</option>
                  <option value="Mexico">Mexico</option>
                  <option value="Moldova">Moldova</option>
                  <option value="Monaco">Monaco</option>
                  <option value="Mongolia">Mongolia</option>
                  <option value="Morocco">Morocco</option>
                  <option value="Myanmar">Myanmar</option>
                  <option value="Nepal">Nepal</option>
                  <option value="Netherlands">Netherlands</option>
                  <option value="New Zealand">New Zealand</option>
                  <option value="Nicaragua">Nicaragua</option>
                  <option value="Nigeria">Nigeria</option>
                  <option value="North Korea">North Korea</option>
                  <option value="Norway">Norway</option>
                  <option value="Oman">Oman</option>
                  <option value="Pakistan">Pakistan</option>
                  <option value="Palestine">Palestine</option>
                  <option value="Panama">Panama</option>
                  <option value="Papua New Guinea">Papua New Guinea</option>
                  <option value="Paraguay">Paraguay</option>
                  <option value="Peru">Peru</option>
                  <option value="Poland">Poland</option>
                  <option value="Portugal">Portugal</option>
                  <option value="Puerto Rico">Puerto Rico</option>
                  <option value="Qatar">Qatar</option>
                  <option value="Romania">Romania</option>
                  <option value="Russia">Russia</option>
                  <option value="Saudi Arabia">Saudi Arabia</option>
                  <option value="Serbia">Serbia</option>
                  <option value="Singapore">Singapore</option>
                  <option value="Slovakia">Slovakia</option>
                  <option value="Slovenia">Slovenia</option>
                  <option value="South Africa">South Africa</option>
                  <option value="South Korea">South Korea</option>
                  <option value="Spain">Spain</option>
                  <option value="Sri Lanka">Sri Lanka</option>
                  <option value="Sweden">Sweden</option>
                  <option value="Switzerland">Switzerland</option>
                  <option value="Syria">Syria</option>
                  <option value="Taiwan">Taiwan</option>
                  <option value="Thailand">Thailand</option>
                  <option value="Turkey">Turkey</option>
                  <option value="Ukraine">Ukraine</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="United States">United States</option>
                  <option value="Uruguay">Uruguay</option>
                  <option value="Uzbekistan">Uzbekistan</option>
                  <option value="Venezuela">Venezuela</option>
                  <option value="Vietnam">Vietnam</option>
                  <option value="Yemen">Yemen</option>
                  <option value="Zimbabwe">Zimbabwe</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Occupation (optional)</label>
                <input
                  type="text"
                  name="occupation"
                  value={form.occupation}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Company (optional)</label>
                <input
                  type="text"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                />
              </div>
            </div>

<div className="form-group">
              <label>Are you attending? *</label>
              <div className="rsvp-buttons-register">
                <button
                  type="button"
                  className={`btn-rsvp ${form.rsvp === 'going' ? 'active going' : ''}`}
                  onClick={() => setForm({...form, rsvp: 'going'})}
                >
                  ✓ Going
                </button>
                <button
                  type="button"
                  className={`btn-rsvp ${form.rsvp === 'maybe' ? 'active maybe' : ''}`}
                  onClick={() => setForm({...form, rsvp: 'maybe'})}
                >
                  ? Maybe
                </button>
                <button
                  type="button"
                  className={`btn-rsvp ${form.rsvp === 'not_going' ? 'active not-going' : ''}`}
                  onClick={() => setForm({...form, rsvp: 'not_going'})}
                >
                  ✗ Not Going
                </button>
              </div>
            </div>

            <div className="button-row">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary">
                Back
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Registering...' : 'Complete Registration'}
              </button>
            </div>
          </form>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}
