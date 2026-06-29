import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPatch } from '../api';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function MovieScreeningsTab() {
  const [event, setEvent] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [stats, setStats] = useState(null);
  const [cinemaStats, setCinemaStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // GCash PDF matching state
  const [gcashMatches, setGcashMatches] = useState({});
  const [gcashParsing, setGcashParsing] = useState(false);
  const fileInputRef = useRef(null);

  // Derive cinema name from code (C3 -> "Cinema 3", C4 -> "Cinema 4")
  const getCinemaName = (code) => {
    if (!code) return '';
    const match = code.match(/^C(\d+)$/);
    return match ? `Cinema ${match[1]}` : code;
  };

  useEffect(() => {
    fetchActiveEvent();
  }, []);

  const fetchActiveEvent = async () => {
    try {
      const res = await apiGet('/api/movie-screening/active');
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load event');
        setLoading(false);
        return;
      }

      if (data.event) {
        setEvent(data.event);
        fetchReservations(data.event.id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
      setLoading(false);
    }
  };

  const fetchReservations = async (eventId) => {
    try {
      const res = await apiGet(`/api/movie-screening/admin/reservations?event_id=${eventId}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load reservations');
        return;
      }

      setReservations(data.reservations || []);
      setStats(data.stats);
      setCinemaStats(data.cinemaStats || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'confirm' }));
    try {
      const res = await apiPost(`/api/movie-screening/admin/${id}/confirm`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to confirm reservation');
        return;
      }

      // Refresh data
      fetchReservations(event.id);
    } catch (err) {
      console.error(err);
      alert('Failed to confirm reservation');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;

    setActionLoading(prev => ({ ...prev, [id]: 'cancel' }));
    try {
      const res = await apiPost(`/api/movie-screening/admin/${id}/cancel`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to cancel reservation');
        return;
      }

      // Refresh data
      fetchReservations(event.id);
    } catch (err) {
      console.error(err);
      alert('Failed to cancel reservation');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const formatTicketRange = (reservation) => {
    if (reservation.status !== 'confirmed' || !reservation.serial_start) {
      return '-';
    }

    const code = reservation.cinema_code;
    const start = String(reservation.serial_start).padStart(8, '0');
    const end = String(reservation.serial_end).padStart(8, '0');
    const count = reservation.quantity;

    if (reservation.serial_start === reservation.serial_end) {
      return `${code}-${start}`;
    }
    return `${code}-${start} to ${code}-${end}`;
  };

  const copyTicketRange = (reservation) => {
    const range = formatTicketRange(reservation);
    const count = reservation.quantity;
    const text = `${range} (x${count})`;
    navigator.clipboard.writeText(text);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Parse GCash PDF and match against pending reservations
  // GCash PDF format: table with columns "Date and Time", "Description", "Reference No.", "Debit", "Credit", "Balance"
  // Skip summary rows: STARTING BALANCE, ENDING BALANCE, Total Debit, Total Credit
  const handleGcashUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGcashParsing(true);
    setGcashMatches({});

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      // Parse transactions from the PDF text
      // Reference numbers are 10-15 digits
      // We need to find each reference number and its associated Credit amount
      const refToCreditMap = {};

      // Skip summary/header rows containing these keywords
      const skipKeywords = ['STARTING BALANCE', 'ENDING BALANCE', 'Total Debit', 'Total Credit',
                           'Date and Time', 'Description', 'Reference No.', 'Debit', 'Credit', 'Balance'];

      // Split text into logical rows (by newlines or multiple spaces)
      const lines = fullText.split(/\n/).filter(line => line.trim());

      for (const line of lines) {
        // Skip header and summary rows
        if (skipKeywords.some(kw => line.toUpperCase().includes(kw.toUpperCase()))) {
          continue;
        }

        // Find reference number (10-15 digits)
        const refMatch = line.match(/\b(\d{10,15})\b/);
        if (!refMatch) continue;

        const refNo = refMatch[1];

        // Extract all currency amounts from the line
        // Format: numbers with optional commas and decimals (e.g., "1,500.00" or "500.00" or "500")
        const amountPattern = /(?:PHP\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
        const amounts = [];
        let amountMatch;
        while ((amountMatch = amountPattern.exec(line)) !== null) {
          const amt = parseFloat(amountMatch[1].replace(/,/g, ''));
          // Filter out amounts that look like reference numbers or dates
          if (amt > 0 && amt < 1000000) {
            amounts.push(amt);
          }
        }

        // In the GCash table format: Date, Description, Reference, Debit, Credit, Balance
        // After the reference number, we expect: Debit (or empty), Credit (incoming), Balance
        // The Credit column is the 2nd numeric column after reference (1st is Debit)
        // However, PDF text extraction may not preserve column order perfectly

        // Heuristic: Look at text AFTER the reference number to find amounts
        const refIndex = line.indexOf(refNo);
        const afterRef = line.substring(refIndex + refNo.length);

        const afterRefAmounts = [];
        const afterRefPattern = /(?:PHP\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
        let afterMatch;
        while ((afterMatch = afterRefPattern.exec(afterRef)) !== null) {
          const amt = parseFloat(afterMatch[1].replace(/,/g, ''));
          if (amt > 0 && amt < 1000000) {
            afterRefAmounts.push(amt);
          }
        }

        // After Reference No., the order is: Debit, Credit, Balance
        // For incoming payments (GCash receive), Debit might be empty/0, Credit has the amount
        // We want the Credit column value (2nd amount after reference, or 1st if Debit is empty)
        if (afterRefAmounts.length >= 2) {
          // Assume: [Debit, Credit, Balance] or just [Credit, Balance] if Debit is empty
          // If we have 3 amounts: [Debit, Credit, Balance] - take index 1 (Credit)
          // If we have 2 amounts: [Credit, Balance] - take index 0 (Credit)
          const creditAmount = afterRefAmounts.length >= 3 ? afterRefAmounts[1] : afterRefAmounts[0];
          refToCreditMap[refNo] = creditAmount;
        } else if (afterRefAmounts.length === 1) {
          // Only one amount found - could be Credit or Balance
          // This is ambiguous, but we'll take it as a potential credit
          refToCreditMap[refNo] = afterRefAmounts[0];
        }
      }

      const parsedCount = Object.keys(refToCreditMap).length;

      // If no transactions parsed, show clear message and log raw text
      if (parsedCount === 0) {
        console.warn('GCash PDF Parser: No transactions found. Raw text:\n', fullText);
        alert(`No transactions could be parsed from the PDF.\n\nExpected format: GCash history table with columns "Date and Time", "Description", "Reference No.", "Debit", "Credit", "Balance".\n\nCheck the browser console for the raw extracted text.`);
        return;
      }

      console.log(`GCash PDF Parser: Found ${parsedCount} transactions`, refToCreditMap);

      // Match against pending reservations
      const matches = {};
      const pendingReservations = reservations.filter(r => r.status === 'pending');

      pendingReservations.forEach(reservation => {
        // Normalize reference: strip non-digits and spaces
        const normalizedRef = reservation.gcash_ref.replace(/\D/g, '');
        const expectedAmount = parseFloat(reservation.total_amount);

        // Look for the reference in our parsed map
        const foundCredit = refToCreditMap[normalizedRef];

        if (foundCredit !== undefined) {
          // Reference found - check if Credit amount matches reservation total
          if (Math.abs(foundCredit - expectedAmount) < 1) {
            matches[reservation.id] = 'match';
          } else {
            matches[reservation.id] = 'amount_off';
          }
        } else {
          // Check if reference exists anywhere (might be different length variant)
          const foundRef = Object.keys(refToCreditMap).find(ref =>
            ref.includes(normalizedRef) || normalizedRef.includes(ref)
          );

          if (foundRef) {
            // Ref found with different length - check amount
            const credit = refToCreditMap[foundRef];
            if (Math.abs(credit - expectedAmount) < 1) {
              matches[reservation.id] = 'match';
            } else {
              matches[reservation.id] = 'amount_off';
            }
          } else {
            matches[reservation.id] = 'not_found';
          }
        }
      });

      setGcashMatches(matches);
    } catch (err) {
      console.error('Error parsing PDF:', err);
      alert('Failed to parse PDF file. Please ensure it is a valid GCash history export.');
    } finally {
      setGcashParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['buyer_name', 'cinema_code', 'quantity', 'unit_price', 'total_amount', 'gcash_ref', 'status', 'ticket_range'];
    const rows = reservations.map(r => [
      r.buyer_name,
      r.cinema_code,
      r.quantity,
      r.unit_price,
      r.total_amount,
      r.gcash_ref,
      r.status,
      r.status === 'confirmed' ? formatTicketRange(r) : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `movie-screening-reservations-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="invite-section">
        <h3>Movie Screenings</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="invite-section">
        <h3>Movie Screenings</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>No active screening event.</p>
      </div>
    );
  }

  return (
    <div className="invite-section">
      <h3>Movie Screenings</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
        {event.title} {event.subtitle ? `- ${event.subtitle}` : ''}
      </p>

      {error && <p className="error">{error}</p>}

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card">
            <div className="stat-number">{stats.total_reservations}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card maybe">
            <div className="stat-number">{stats.pending_count}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card going">
            <div className="stat-number">{stats.confirmed_count}</div>
            <div className="stat-label">Confirmed</div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(207, 181, 59, 0.1)' }}>
            <div className="stat-number" style={{ color: '#CFB53B' }}>{formatCurrency(stats.total_collected)}</div>
            <div className="stat-label">Collected</div>
          </div>
        </div>
      )}

      {/* Seat Bars */}
      {cinemaStats.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-primary)' }}>
            Seat Availability
          </h4>
          {cinemaStats.map((cinema) => {
            const percentage = cinema.capacity > 0 ? (cinema.held_seats / cinema.capacity) * 100 : 0;
            return (
              <div key={cinema.code} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                    {getCinemaName(cinema.code)}
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{cinema.label}</span>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {cinema.held_seats} / {cinema.capacity} held
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${percentage}%`,
                    background: percentage > 90 ? '#b91c1c' : percentage > 70 ? '#b45309' : '#006633',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleGcashUpload}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary"
          disabled={gcashParsing}
          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
        >
          {gcashParsing ? 'Parsing...' : 'Upload GCash History'}
        </button>
        <button
          onClick={exportCSV}
          className="btn-secondary"
          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
        >
          Export CSV
        </button>
      </div>

      {/* GCash match legend */}
      {Object.keys(gcashMatches).length > 0 && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          fontSize: '0.8rem'
        }}>
          <span style={{ marginRight: '16px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: '#047857', marginRight: '6px' }}></span>
            Match
          </span>
          <span style={{ marginRight: '16px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: '#b45309', marginRight: '6px' }}></span>
            Amount off
          </span>
          <span>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: '#b91c1c', marginRight: '6px' }}></span>
            Not found
          </span>
        </div>
      )}

      {/* Reservations Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ minWidth: '900px' }}>
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Cinema</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>GCash Ref</th>
              <th>GCash Check</th>
              <th>Ticket Numbers</th>
              <th>Status/Action</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No reservations yet
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    background: gcashMatches[r.id] === 'match' ? 'rgba(4, 120, 87, 0.1)' :
                               gcashMatches[r.id] === 'amount_off' ? 'rgba(180, 83, 9, 0.1)' :
                               gcashMatches[r.id] === 'not_found' ? 'rgba(185, 28, 28, 0.1)' : 'transparent'
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.buyer_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {r.mobile || r.email}
                    </div>
                    {r.quantity >= 20 && (
                      <span style={{
                        display: 'inline-block',
                        marginTop: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(207, 181, 59, 0.15)',
                        color: '#CFB53B'
                      }}>
                        20+ seat choice
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{getCinemaName(r.cinema_code)}</div>
                    {r.cinema_label && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{r.cinema_label}</div>}
                  </td>
                  <td>{r.quantity}</td>
                  <td>{formatCurrency(r.total_amount)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.gcash_ref}</td>
                  <td>
                    {r.gcash_verified ? (
                      <span style={{ color: '#047857' }}>Verified</span>
                    ) : (
                      gcashMatches[r.id] === 'match' ? (
                        <span style={{ color: '#047857', fontWeight: 600 }}>Match</span>
                      ) : gcashMatches[r.id] === 'amount_off' ? (
                        <span style={{ color: '#b45309', fontWeight: 600 }}>Amount off</span>
                      ) : gcashMatches[r.id] === 'not_found' ? (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>Not found</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                      )
                    )}
                  </td>
                  <td>
                    {r.status === 'confirmed' && r.serial_start ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {formatTicketRange(r)}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(0, 102, 51, 0.15)',
                          color: '#006633'
                        }}>
                          x{r.quantity}
                        </span>
                        <button
                          onClick={() => copyTicketRange(r)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            fontSize: '0.8rem',
                            color: 'var(--color-text-secondary)'
                          }}
                          title="Copy ticket range"
                        >
                          Copy
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleConfirm(r.id)}
                          disabled={actionLoading[r.id]}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            background: '#006633',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            opacity: actionLoading[r.id] ? 0.6 : 1
                          }}
                        >
                          {actionLoading[r.id] === 'confirm' ? '...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={actionLoading[r.id]}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            background: 'transparent',
                            color: '#b91c1c',
                            border: '1px solid #b91c1c',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            opacity: actionLoading[r.id] ? 0.6 : 1
                          }}
                        >
                          {actionLoading[r.id] === 'cancel' ? '...' : 'Cancel'}
                        </button>
                      </div>
                    ) : r.status === 'confirmed' ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'rgba(4, 120, 87, 0.1)',
                        color: '#047857'
                      }}>
                        Confirmed
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'rgba(185, 28, 28, 0.1)',
                        color: '#b91c1c'
                      }}>
                        Cancelled
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
