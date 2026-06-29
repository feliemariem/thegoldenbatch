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

      // Extract reference numbers and amounts from the text
      // GCash reference numbers are typically 13 digits
      // Amounts are typically formatted as "PHP X,XXX.XX" or just numbers
      const refPattern = /\b(\d{13})\b/g;
      const amountPattern = /(?:PHP\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;

      const refMatches = [...fullText.matchAll(refPattern)].map(m => m[1]);
      const amountMatches = [...fullText.matchAll(amountPattern)].map(m =>
        parseFloat(m[1].replace(/,/g, ''))
      );

      // Create a map of reference numbers to their nearby amounts
      // This is a simplified heuristic - in practice you'd need more sophisticated parsing
      const refAmountMap = {};
      refMatches.forEach((ref, idx) => {
        // Try to find a nearby amount (within a few positions)
        if (amountMatches[idx]) {
          refAmountMap[ref] = amountMatches[idx];
        }
      });

      // Match against pending reservations
      const matches = {};
      const pendingReservations = reservations.filter(r => r.status === 'pending');

      pendingReservations.forEach(reservation => {
        const normalizedRef = reservation.gcash_ref.replace(/\D/g, '');
        const expectedAmount = reservation.total_amount;

        if (refAmountMap[normalizedRef] !== undefined) {
          const foundAmount = refAmountMap[normalizedRef];
          if (Math.abs(foundAmount - expectedAmount) < 1) {
            matches[reservation.id] = 'match';
          } else {
            matches[reservation.id] = 'amount_off';
          }
        } else if (refMatches.includes(normalizedRef)) {
          // Reference found but no matching amount nearby
          matches[reservation.id] = 'amount_off';
        } else {
          matches[reservation.id] = 'not_found';
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
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{cinema.label}</span>
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
                  <td>{r.cinema_label || r.cinema_code}</td>
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
