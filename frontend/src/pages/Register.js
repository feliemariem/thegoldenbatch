import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import { api, apiPostPublic } from '../api';

export default function Register() {
  const { token: inviteToken } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, setThemeTemporary, toggleTheme } = useTheme();
  const previousThemeRef = useRef(theme);

  const [validating, setValidating] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(1); // 1: password, 2: disclaimer, 3: form
  const [showPassword, setShowPassword] = useState(false);

  // Graduate self-identification state (null = not answered, true = yes, false = no)
  const [isGraduate, setIsGraduate] = useState(null);
  const [masterListId, setMasterListId] = useState(null);
  const [masterListSelected, setMasterListSelected] = useState(null); // { id, first_name, last_name, current_name, section }
  const [masterListSearch, setMasterListSearch] = useState('');
  const [masterListResults, setMasterListResults] = useState([]);
  const [showMasterListDropdown, setShowMasterListDropdown] = useState(false);
  const [masterListPrelinked, setMasterListPrelinked] = useState(false); // true if invite was already linked
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

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

  // Force dark theme on this page
  useEffect(() => {
    previousThemeRef.current = theme;
    if (theme !== 'dark') {
      setThemeTemporary('dark');
    }
    return () => {
      if (previousThemeRef.current !== 'dark') {
        setThemeTemporary(previousThemeRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Validate invite token
    api(`/api/invites/${inviteToken}/validate`)
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
          // If invite is already linked to master_list, pre-populate graduate info
          if (data.master_list_id && data.master_list) {
            setIsGraduate(true);
            setMasterListId(data.master_list_id);
            setMasterListSelected(data.master_list);
            setMasterListPrelinked(true);
          }
        } else {
          setError(data.error || 'Invalid invite link');
        }
      })
      .catch(() => setError('Could not validate invite'))
      .finally(() => setValidating(false));
  }, [inviteToken]);

  // Search master list for graduates
  const searchMasterList = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setMasterListResults([]);
      return;
    }

    try {
      const res = await api(`/api/master-list/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setMasterListResults(data);
        setShowMasterListDropdown(data.length > 0);
      }
    } catch (err) {
      console.error('Error searching master list:', err);
    }
  }, []);

  // Debounced search on input change
  const handleMasterListSearchChange = (e) => {
    const value = e.target.value;
    setMasterListSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchMasterList(value);
    }, 300);
  };

  // Select a master list entry
  const handleSelectMasterList = (entry) => {
    setMasterListId(entry.id);
    setMasterListSelected(entry);
    setMasterListSearch('');
    setMasterListResults([]);
    setShowMasterListDropdown(false);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowMasterListDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format master list entry for display: "Last, First · Section"
  const formatMasterListEntry = (entry) => {
    const name = entry.current_name || `${entry.last_name}, ${entry.first_name}`;
    return `${name} · ${entry.section}`;
  };

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

    // Validate graduate question is answered
    if (isGraduate === null) {
      setError('Please answer whether you are a USLS-IS Batch 2003 graduate');
      return;
    }

    // Validate graduate selection if answered Yes
    if (isGraduate === true && !masterListId) {
      setError('Please find and select your name from the graduation list');
      return;
    }

    if (!form.rsvp) {
      setError('Please select if you are attending');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        invite_token: inviteToken,
        ...form,
      };

      // Include master_list_id if user selected one
      if (masterListId) {
        payload.master_list_id = masterListId;
      }

      const res = await apiPostPublic('/api/auth/register', payload);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      login(data.user);
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
                <h3>How We Use Your Information</h3>
                <p>
                  Your information will be used solely for organizing our alumni homecoming, including:
                </p>
                <ul>
                  <li>Contacting you with event updates and announcements</li>
                  <li>Creating a batch directory to help classmates reconnect</li>
                  <li>Planning event logistics based on attendance</li>
                </ul>
                <p>
                  Your data will only be shared with fellow batch members and the organizing
                  committee—never with third parties or for commercial purposes. You may request
                  to update or remove your information anytime.
                </p>

                <h4>Data Privacy Consent</h4>
                <p>
                  By registering, I voluntarily give my consent to the collection, use, processing, and
                  retention of my personal information by USLS-IS Batch 2003 in accordance with the Data Privacy Act of 2012
                  (R.A. 10173) and its implementing rules. I understand that my information shall be used solely for 
                  legitimate purposes related to USLS-IS Batch 2003 activities, protected by reasonable security 
                  measures, and retained only as long as necessary or as required by law. I acknowledge my rights as a data
                  subject under the law.
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

              {/* Graduate Self-Identification */}
              <div className="form-group" style={{ marginTop: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  Are you a USLS-IS Batch 2003 graduate? *
                </label>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: masterListPrelinked ? 'default' : 'pointer' }}>
                    <input
                      type="radio"
                      name="isGraduate"
                      checked={isGraduate === true}
                      onChange={() => {
                        setIsGraduate(true);
                      }}
                      disabled={masterListPrelinked}
                      style={{ width: 'auto' }}
                    />
                    <span>Yes</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: masterListPrelinked ? 'default' : 'pointer' }}>
                    <input
                      type="radio"
                      name="isGraduate"
                      checked={isGraduate === false}
                      onChange={() => {
                        setIsGraduate(false);
                        // Clear selection if No (unless pre-linked)
                        if (!masterListPrelinked) {
                          setMasterListId(null);
                          setMasterListSelected(null);
                        }
                      }}
                      disabled={masterListPrelinked}
                      style={{ width: 'auto' }}
                    />
                    <span>No</span>
                  </label>
                </div>

                {isGraduate === true && (
                  <div style={{ marginTop: '12px' }} ref={dropdownRef}>
                    {masterListSelected ? (
                      // Show selected entry
                      <div style={{
                        padding: '12px 16px',
                        background: 'rgba(39, 174, 96, 0.1)',
                        border: '1px solid rgba(39, 174, 96, 0.3)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {formatMasterListEntry(masterListSelected)}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-status-positive)' }}>
                            ✓ {masterListPrelinked ? 'Auto-matched from records' : 'Selected'}
                          </div>
                        </div>
                        {!masterListPrelinked && (
                          <button
                            type="button"
                            onClick={() => {
                              setMasterListId(null);
                              setMasterListSelected(null);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              textDecoration: 'underline'
                            }}
                          >
                            Change
                          </button>
                        )}
                      </div>
                    ) : (
                      // Show search input
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem' }}>
                          Find your name in the graduation list *
                        </label>
                        <input
                          type="text"
                          value={masterListSearch}
                          onChange={handleMasterListSearchChange}
                          placeholder="Start typing your name..."
                          autoComplete="off"
                        />
                        {showMasterListDropdown && masterListResults.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--color-card-bg)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            marginTop: '4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 100,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }}>
                            {masterListResults.map((entry) => (
                              <div
                                key={entry.id}
                                onClick={() => handleSelectMasterList(entry)}
                                style={{
                                  padding: '10px 14px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--color-border)',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(207, 181, 59, 0.1)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                  {entry.last_name}, {entry.first_name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                  Section {entry.section}
                                  {entry.current_name && entry.current_name !== `${entry.first_name} ${entry.last_name}` && (
                                    <span> · Now: {entry.current_name}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                <label>Are you attending our homecoming on December 16, 2028  at Santuario de La Salle, USLS, Bacolod City? *</label>
                <div className="rsvp-buttons-register">
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp === 'going' ? 'active going' : ''}`}
                    onClick={() => setForm({ ...form, rsvp: 'going' })}
                  >
                    ✓ Going
                  </button>
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp === 'maybe' ? 'active maybe' : ''}`}
                    onClick={() => setForm({ ...form, rsvp: 'maybe' })}
                  >
                    ? Maybe
                  </button>
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp === 'not_going' ? 'active not-going' : ''}`}
                    onClick={() => setForm({ ...form, rsvp: 'not_going' })}
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
