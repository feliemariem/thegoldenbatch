import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiPatch } from '../api';
// Use pdfjs-dist/webpack which auto-configures the worker using import.meta.url
// This bundles the worker locally so it never depends on a CDN
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';

// Milestone constants for block screening tracking
const MILESTONE_CINEMA_BALANCE = 127;    // Cinema balance paid threshold
const MILESTONE_BREAKEVEN = 268;         // Break-even, fund repaid
const MILESTONE_SELLOUT = 468;           // Total capacity / sellout
const MILESTONE_CINEMA_DATE = new Date('2026-07-24');  // Cinema balance due date
const MILESTONE_SELLOUT_DATE = new Date('2026-07-31'); // Event date
const CINEMA_BALANCE_AMOUNT = 70870;     // P70,870 due
const FUND_AMOUNT = 80000;               // P80,000 fund
const SELLOUT_PROFIT = 112190;           // P112,190 profit at sellout

export default function MovieScreeningsTab({ permissions = {}, isSuperAdmin = false }) {
  // Determine access level from permissions
  // Super admin has all access; otherwise check specific permissions
  const hasTrackerAccess = isSuperAdmin || permissions.screenings_tracker || permissions.screenings_edit;
  const hasEditAccess = isSuperAdmin || permissions.screenings_edit;
  const hasStatsAccess = isSuperAdmin || permissions.screenings_stats || permissions.screenings_tracker || permissions.screenings_edit;
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

  // Copy feedback state: tracks which field was just copied { id, type }
  const [copiedField, setCopiedField] = useState(null);

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
      // If user has tracker access, fetch full reservations; otherwise fetch stats only
      if (hasTrackerAccess) {
        const res = await apiGet(`/api/movie-screening/admin/reservations?event_id=${eventId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load reservations');
          return;
        }

        // Sort by created_at (oldest first) for processing order
        const sorted = (data.reservations || []).sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
        setReservations(sorted);
        setStats(data.stats);
        setCinemaStats(data.cinemaStats || []);
      } else {
        // Stats-only access
        const res = await apiGet(`/api/movie-screening/admin/stats?event_id=${eventId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load stats');
          return;
        }

        setReservations([]); // No reservation data for stats-only users
        setStats(data.stats);
        setCinemaStats(data.cinemaStats || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch data');
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

  const handleToggleClaimed = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'claim' }));
    try {
      const res = await apiPost(`/api/movie-screening/admin/${id}/claim`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to update claim status');
        return;
      }

      // Update reservation in local state
      setReservations(prev => prev.map(r =>
        r.id === id
          ? { ...r, claimed: data.claimed, claimed_by: data.claimed_by, claimed_at: data.claimed_at, claimed_by_name: data.claimed_by_name }
          : r
      ));
    } catch (err) {
      console.error(err);
      alert('Failed to update claim status');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleGenerateSeatLink = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'seatlink' }));
    try {
      const res = await apiPost(`/api/movie-screening/admin/${id}/generate-seat-link`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to generate seat link');
        return;
      }

      // Copy the URL to clipboard
      await copyToClipboard(data.url, id, 'seatlink');
    } catch (err) {
      console.error(err);
      alert('Failed to generate seat link');
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

  // Generic copy helper
  const copyToClipboard = async (text, id, type) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    // Show copied feedback
    setCopiedField({ id, type });
    setTimeout(() => setCopiedField(null), 1500);
  };

  const copyTicketRange = async (reservation) => {
    const range = formatTicketRange(reservation);
    const text = `${range} (x${reservation.quantity})`;
    await copyToClipboard(text, reservation.id, 'ticket');
  };

  const copyContact = async (reservation, type) => {
    const text = type === 'mobile' ? reservation.mobile : reservation.email;
    if (text) {
      await copyToClipboard(text, reservation.id, type);
    }
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
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).replace(',', ' ·');
  };

  // Parse GCash PDF and match against pending reservations
  // Uses x-coordinates to properly extract data from columns
  const handleGcashUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGcashParsing(true);
    setGcashMatches({});

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      // Collect all text items with their coordinates across all pages
      const allItems = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        for (const item of textContent.items) {
          if (item.str && item.str.trim()) {
            allItems.push({
              text: item.str,
              x: item.transform[4],
              y: item.transform[5],
              page: i
            });
          }
        }
      }

      // Find column header positions by looking for the header text
      let refColX = null, debitColX = null, creditColX = null, balanceColX = null;

      for (const item of allItems) {
        const t = item.text.trim().toLowerCase();
        if (t === 'reference no.' || t === 'reference no') {
          refColX = item.x;
        } else if (t === 'debit') {
          debitColX = item.x;
        } else if (t === 'credit') {
          creditColX = item.x;
        } else if (t === 'balance') {
          balanceColX = item.x;
        }
      }

      console.log('[GCash Parse] Column X positions:', { refColX, debitColX, creditColX, balanceColX });

      // Group items into rows by y-coordinate (items within 3 units are same row)
      const rowTolerance = 3;
      const rowMap = new Map();

      for (const item of allItems) {
        // Find existing row or create new one
        let foundRowY = null;
        for (const rowY of rowMap.keys()) {
          if (Math.abs(item.y - rowY) < rowTolerance) {
            foundRowY = rowY;
            break;
          }
        }

        if (foundRowY !== null) {
          rowMap.get(foundRowY).push(item);
        } else {
          rowMap.set(item.y, [item]);
        }
      }

      // Sort rows by y descending (PDF y increases upward, so higher y = earlier in document)
      const sortedRows = Array.from(rowMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([y, items]) => ({ y, items: items.sort((a, b) => a.x - b.x) }));

      // Helper to determine which column an x-position belongs to
      const getColumn = (x) => {
        if (refColX === null || debitColX === null || creditColX === null || balanceColX === null) {
          return null;
        }
        // Use midpoints between columns as boundaries
        const refEnd = (refColX + debitColX) / 2;
        const debitEnd = (debitColX + creditColX) / 2;
        const creditEnd = (creditColX + balanceColX) / 2;

        if (x < refEnd) return 'ref';
        if (x < debitEnd) return 'debit';
        if (x < creditEnd) return 'credit';
        return 'balance';
      };

      // Parse transactions from rows
      // Each transaction row starts with a date (YYYY-MM-DD HH:MM)
      const datePattern = /^\d{4}-\d{2}-\d{2}/;
      const transactions = [];
      let previousBalance = 0;

      // Find STARTING BALANCE first
      for (const row of sortedRows) {
        const rowText = row.items.map(i => i.text).join(' ');
        if (rowText.includes('STARTING BALANCE') || rowText.includes('Starting Balance')) {
          // Find the balance amount in this row
          for (const item of row.items) {
            const amt = item.text.replace(/,/g, '');
            if (/^\d+\.\d{2}$/.test(amt)) {
              previousBalance = parseFloat(amt);
              console.log('[GCash Parse] Starting balance:', previousBalance);
              break;
            }
          }
          break;
        }
      }

      // Process transaction rows
      for (const row of sortedRows) {
        const rowText = row.items.map(i => i.text).join(' ');

        // Skip summary rows
        if (rowText.includes('STARTING BALANCE') || rowText.includes('ENDING BALANCE') ||
            rowText.includes('Total Debit') || rowText.includes('Total Credit') ||
            rowText.includes('Starting Balance') || rowText.includes('Ending Balance')) {
          continue;
        }

        // Check if row starts with a date (transaction row)
        const firstItem = row.items[0];
        if (!firstItem || !datePattern.test(firstItem.text)) {
          continue;
        }

        // Extract values by column position
        let refNo = null;
        let debitAmt = null;
        let creditAmt = null;
        let balanceAmt = null;

        for (const item of row.items) {
          const col = getColumn(item.x);
          const text = item.text.trim();

          if (col === 'ref') {
            // Reference: look for 10-15 digit number
            const refMatch = text.match(/\d{10,15}/);
            if (refMatch) {
              refNo = refMatch[0];
            }
          } else if (col === 'debit' || col === 'credit' || col === 'balance') {
            // Parse amount
            const cleaned = text.replace(/,/g, '');
            if (/^\d+\.\d{2}$/.test(cleaned)) {
              const amt = parseFloat(cleaned);
              if (col === 'debit') debitAmt = amt;
              else if (col === 'credit') creditAmt = amt;
              else if (col === 'balance') balanceAmt = amt;
            }
          }
        }

        // Extract invoice number (invno) - look for a second long number in the row
        // Bank transfers often have an invoice/transaction number separate from the GCash ref
        let invNo = null;
        const allNumbers = rowText.match(/\b\d{6,20}\b/g) || [];
        for (const num of allNumbers) {
          if (num !== refNo && num.length >= 6) {
            invNo = num;
            break;
          }
        }

        // If we have a reference, record the transaction
        if (refNo) {
          transactions.push({
            refNo,
            invNo,
            debit: debitAmt,
            credit: creditAmt,
            balance: balanceAmt,
            rowText
          });
        }
      }

      console.log('[GCash Parse] Transactions found:', transactions.length);

      // If column-based parsing failed (no columns found), fall back to row-based parsing
      if (refColX === null || transactions.length === 0) {
        console.log('[GCash Parse] Falling back to row-based parsing...');
        transactions.length = 0; // Clear

        // Re-parse using the fallback method: segment by date, use balance changes
        for (const row of sortedRows) {
          const rowText = row.items.map(i => i.text).join(' ');

          // Skip summary rows
          if (rowText.includes('STARTING BALANCE') || rowText.includes('ENDING BALANCE') ||
              rowText.includes('Total Debit') || rowText.includes('Total Credit')) {
            continue;
          }

          // Check if row starts with a date
          if (!datePattern.test(row.items[0]?.text || '')) {
            continue;
          }

          // Find reference number (10-15 digits)
          const refMatch = rowText.match(/\b(\d{10,15})\b/);
          if (!refMatch) continue;
          const refNo = refMatch[1];

          // Find all decimal amounts in the row
          const amounts = [];
          const amtPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
          let m;
          while ((m = amtPattern.exec(rowText)) !== null) {
            amounts.push(parseFloat(m[1].replace(/,/g, '')));
          }

          // Last amount is balance, second-to-last is debit or credit
          if (amounts.length >= 2) {
            const balance = amounts[amounts.length - 1];
            const amount = amounts[amounts.length - 2];

            // Determine if credit or debit by balance change
            const balanceChange = balance - previousBalance;
            const isCredit = balanceChange > 0;

            // Extract invoice number (invno) - look for a second long number
            let invNo = null;
            const allNumbers = rowText.match(/\b\d{6,20}\b/g) || [];
            for (const num of allNumbers) {
              if (num !== refNo && num.length >= 6) {
                invNo = num;
                break;
              }
            }

            transactions.push({
              refNo,
              invNo,
              debit: isCredit ? null : amount,
              credit: isCredit ? amount : null,
              balance
            });

            previousBalance = balance;
          }
        }

        console.log('[GCash Parse] Fallback found transactions:', transactions.length);
      }

      // Build the reference map: ref -> { credit, debit, invNo }
      const refMap = {};
      for (const txn of transactions) {
        const normalizedRef = txn.refNo.replace(/\D/g, '');
        refMap[normalizedRef] = {
          credit: txn.credit,
          debit: txn.debit,
          balance: txn.balance,
          invNo: txn.invNo ? txn.invNo.replace(/\D/g, '') : null
        };
      }

      console.log('[GCash Match] All ref keys:', Object.keys(refMap));
      console.log('[GCash Match] Full ref map:', JSON.stringify(refMap, null, 2));
      console.log('[GCash Match] Total refs:', Object.keys(refMap).length);

      // Match against pending reservations
      const matches = {};
      const pendingReservations = reservations.filter(r => r.status === 'pending');

      pendingReservations.forEach(reservation => {
        const normalizedRef = (reservation.gcash_ref || '').replace(/\D/g, '');
        const expectedAmount = parseFloat(reservation.total_amount);

        console.log(`[GCash Match] Checking reservation ${reservation.id}: ref="${normalizedRef}", expected=${expectedAmount}`);

        // Look for the reference in our map
        let foundRef = null;
        let foundData = null;

        // Exact match first
        if (refMap[normalizedRef]) {
          foundRef = normalizedRef;
          foundData = refMap[normalizedRef];
        } else {
          // Substring match
          for (const pdfRef of Object.keys(refMap)) {
            if (pdfRef.includes(normalizedRef) || normalizedRef.includes(pdfRef)) {
              foundRef = pdfRef;
              foundData = refMap[pdfRef];
              break;
            }
          }
        }

        if (!foundRef) {
          // Try matching against trailing digits of invNo (for bank-to-GCash transfers)
          let partialMatch = null;
          for (const [pdfRef, data] of Object.entries(refMap)) {
            if (data.invNo && data.invNo.endsWith(normalizedRef)) {
              partialMatch = data;
              console.log(`[GCash Match]   → Partial match on invNo trailing digits: ${data.invNo}`);
              break;
            }
          }

          if (partialMatch) {
            const creditAmt = partialMatch.credit;
            if (creditAmt !== null && Math.abs(creditAmt - expectedAmount) < 1) {
              matches[reservation.id] = 'partial_match';
              console.log(`[GCash Match]   → PARTIAL MATCH (invNo trailing digits, amount OK)`);
            } else {
              matches[reservation.id] = 'amount_off';
              console.log(`[GCash Match]   → PARTIAL but AMOUNT OFF (credit=${creditAmt}, expected=${expectedAmount})`);
            }
          } else {
            matches[reservation.id] = 'not_found';
            console.log(`[GCash Match]   → NOT FOUND`);
          }
        } else {
          // Check if this is a credit and if amount matches
          const creditAmt = foundData.credit;
          console.log(`[GCash Match]   → Found: credit=${creditAmt}, debit=${foundData.debit}`);

          if (creditAmt !== null && Math.abs(creditAmt - expectedAmount) < 1) {
            matches[reservation.id] = 'match';
            console.log(`[GCash Match]   → MATCH`);
          } else {
            matches[reservation.id] = 'amount_off';
            console.log(`[GCash Match]   → AMOUNT OFF (credit=${creditAmt}, expected=${expectedAmount})`);
          }
        }
      });

      setGcashMatches(matches);
    } catch (err) {
      console.error('GCash PDF parse error:', err);
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
    const headers = ['buyer_name', 'mobile', 'email', 'purchased', 'cinema_code', 'quantity', 'unit_price', 'total_amount', 'gcash_ref', 'status', 'chosen_seats', 'ticket_range', 'claimed', 'claimed_at'];
    const rows = reservations.map(r => [
      r.buyer_name,
      r.mobile || '',
      r.email || '',
      formatDate(r.created_at),
      r.cinema_code,
      r.quantity,
      r.unit_price,
      r.total_amount,
      r.gcash_ref,
      r.status,
      r.chosen_seats || '',
      r.status === 'confirmed' ? formatTicketRange(r) : '',
      r.claimed ? 'Yes' : 'No',
      r.claimed_at ? formatDate(r.claimed_at) : ''
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
        <h3>Block Screenings</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="invite-section">
        <h3>Block Screenings</h3>
        <p style={{ color: 'var(--color-text-secondary)' }}>No active screening event.</p>
      </div>
    );
  }

  return (
    <div className="invite-section">
      <h3>Block Screenings</h3>
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
          <div className="stat-card going">
            <div className="stat-number">{Number(stats.tickets_sold ?? 0)}</div>
            <div className="stat-label">Tickets Sold</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {Number(stats.tickets_sold_c3 ?? 0)} C3 · {Number(stats.tickets_sold_c4 ?? 0)} C4
            </div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(207, 181, 59, 0.1)' }}>
            <div className="stat-number stat-number--currency" style={{ color: '#CFB53B' }}>{formatCurrency(stats.total_collected)}</div>
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

      {/* Milestones Tracker */}
      {stats && (
        (() => {
          const ticketsSold = Number(stats.tickets_sold ?? 0);
          const percentage = Math.min((ticketsSold / MILESTONE_SELLOUT) * 100, 100);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const daysUntilCinema = Math.max(0, Math.ceil((MILESTONE_CINEMA_DATE - today) / (1000 * 60 * 60 * 24)));
          const daysUntilSellout = Math.max(0, Math.ceil((MILESTONE_SELLOUT_DATE - today) / (1000 * 60 * 60 * 24)));

          const remainingCinema = Math.max(0, MILESTONE_CINEMA_BALANCE - ticketsSold);
          const remainingSellout = Math.max(0, MILESTONE_SELLOUT - ticketsSold);

          const paceToCinema = daysUntilCinema > 0 ? Math.ceil(remainingCinema / daysUntilCinema) : null;
          const paceToSellout = daysUntilSellout > 0 ? Math.ceil(remainingSellout / daysUntilSellout) : null;

          const cinemaHit = ticketsSold >= MILESTONE_CINEMA_BALANCE;
          const breakevenHit = ticketsSold >= MILESTONE_BREAKEVEN;
          const selloutHit = ticketsSold >= MILESTONE_SELLOUT;

          // Days-left indicator for header
          const daysLeftText = daysUntilCinema > 0
            ? `${daysUntilCinema} day${daysUntilCinema === 1 ? '' : 's'} to Jul 24`
            : daysUntilSellout > 0
              ? `${daysUntilSellout} day${daysUntilSellout === 1 ? '' : 's'} to event`
              : null;

          return (
            <div className="ms-milestones-card">
              <div className="ms-header">
                <span className="ms-title">Milestones</span>
                <span className="ms-summary">
                  {ticketsSold} / {MILESTONE_SELLOUT} tickets sold · {percentage.toFixed(1)}%{daysLeftText && ` · ${daysLeftText}`}
                </span>
              </div>

              <div className="ms-progress-container">
                <div className="ms-progress-bar">
                  <div className="ms-progress-fill" style={{ width: `${percentage}%` }} />
                  <div className="ms-marker" style={{ left: `${(MILESTONE_CINEMA_BALANCE / MILESTONE_SELLOUT) * 100}%` }} />
                  <div className="ms-marker" style={{ left: `${(MILESTONE_BREAKEVEN / MILESTONE_SELLOUT) * 100}%` }} />
                </div>
                <div className="ms-tick-labels">
                  <span style={{ left: `${(MILESTONE_CINEMA_BALANCE / MILESTONE_SELLOUT) * 100}%` }}>{MILESTONE_CINEMA_BALANCE}</span>
                  <span style={{ left: `${(MILESTONE_BREAKEVEN / MILESTONE_SELLOUT) * 100}%` }}>{MILESTONE_BREAKEVEN}</span>
                  <span style={{ left: '100%' }}>{MILESTONE_SELLOUT}</span>
                </div>
              </div>

              <div className="ms-legend">
                <div className="ms-legend-row ms-red">
                  <span className="ms-legend-number">{MILESTONE_CINEMA_BALANCE}</span>
                  <span className="ms-legend-desc">Cinema balance paid (₱{CINEMA_BALANCE_AMOUNT.toLocaleString()} due Jul 24)</span>
                  <span className="ms-legend-status">
                    {cinemaHit ? <span className="ms-done">✓ Done</span> : `${remainingCinema} to go`}
                  </span>
                </div>
                <div className="ms-legend-row ms-gold">
                  <span className="ms-legend-number">{MILESTONE_BREAKEVEN}</span>
                  <span className="ms-legend-desc">Break-even, ₱{FUND_AMOUNT.toLocaleString()} fund repaid</span>
                  <span className="ms-legend-status">
                    {breakevenHit ? <span className="ms-done">✓ Done</span> : `${Math.max(0, MILESTONE_BREAKEVEN - ticketsSold)} to go`}
                  </span>
                </div>
                <div className="ms-legend-row ms-green">
                  <span className="ms-legend-number">{MILESTONE_SELLOUT}</span>
                  <span className="ms-legend-desc">Sellout, ₱{SELLOUT_PROFIT.toLocaleString()} profit</span>
                  <span className="ms-legend-status">
                    {selloutHit ? <span className="ms-done">✓ Done</span> : `${remainingSellout} to go`}
                  </span>
                </div>
              </div>

              <div className="ms-pace">
                {!cinemaHit && paceToCinema !== null && (
                  <span>Need {paceToCinema}/day to hit {MILESTONE_CINEMA_BALANCE} by Jul 24</span>
                )}
                {!cinemaHit && paceToCinema !== null && paceToSellout !== null && <span> · </span>}
                {!cinemaHit && paceToCinema === null && remainingCinema > 0 && (
                  <span>{remainingCinema} remaining for cinema balance</span>
                )}
                {cinemaHit && !selloutHit && paceToSellout !== null && (
                  <span>Need {paceToSellout}/day for sellout by Jul 31</span>
                )}
                {cinemaHit && !selloutHit && paceToSellout === null && remainingSellout > 0 && (
                  <span>{remainingSellout} remaining for sellout</span>
                )}
                {!cinemaHit && paceToSellout !== null && (
                  <span>{paceToSellout}/day for sellout</span>
                )}
                {selloutHit && <span className="ms-done">🎉 Sold out!</span>}
              </div>
            </div>
          );
        })()
      )}

      {/* Action buttons - only for users with edit access */}
      {hasTrackerAccess && (
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleGcashUpload}
          style={{ display: 'none' }}
        />
        {hasEditAccess && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary"
          disabled={gcashParsing}
          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
        >
          {gcashParsing ? 'Parsing...' : 'Upload GCash History'}
        </button>
        )}
        {hasEditAccess && (
        <button
          onClick={exportCSV}
          className="btn-secondary"
          style={{ padding: '10px 16px', fontSize: '0.85rem' }}
        >
          Export CSV
        </button>
        )}
      </div>
      )}

      {/* GCash match legend - only for tracker users */}
      {hasTrackerAccess && Object.keys(gcashMatches).length > 0 && (
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
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '2px', background: '#0369a1', marginRight: '6px' }}></span>
            Partial match
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

      {/* Stats-only message for users without tracker access */}
      {!hasTrackerAccess && hasStatsAccess && (
        <div style={{
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)'
        }}>
          <p style={{ margin: 0 }}>You have view-only access to screening statistics.</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem' }}>Contact a super admin if you need access to the full reservation tracker.</p>
        </div>
      )}

      {/* Reservations Table - only for users with tracker access */}
      {hasTrackerAccess && (
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table" style={{ minWidth: '900px' }}>
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Purchased</th>
              <th>Cinema</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>GCash Ref</th>
              <th>GCash Check</th>
              <th>Ticket Numbers</th>
              <th>Seats</th>
              <th>Status/Action</th>
              <th>Claimed</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No reservations yet
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    background: gcashMatches[r.id] === 'match' ? 'rgba(4, 120, 87, 0.1)' :
                               gcashMatches[r.id] === 'partial_match' ? 'rgba(3, 105, 161, 0.1)' :
                               gcashMatches[r.id] === 'amount_off' ? 'rgba(180, 83, 9, 0.1)' :
                               gcashMatches[r.id] === 'not_found' ? 'rgba(185, 28, 28, 0.1)' : 'transparent'
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{r.buyer_name}</div>
                    {r.mobile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {r.mobile}
                        </span>
                        <button
                          onClick={() => copyContact(r, 'mobile')}
                          style={{
                            background: copiedField?.id === r.id && copiedField?.type === 'mobile' ? 'rgba(0, 102, 51, 0.15)' : 'none',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'background 0.2s'
                          }}
                          title={copiedField?.id === r.id && copiedField?.type === 'mobile' ? 'Copied!' : 'Copy mobile'}
                        >
                          {copiedField?.id === r.id && copiedField?.type === 'mobile' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#006633" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                    {r.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.email}>
                          {r.email}
                        </span>
                        <button
                          onClick={() => copyContact(r, 'email')}
                          style={{
                            background: copiedField?.id === r.id && copiedField?.type === 'email' ? 'rgba(0, 102, 51, 0.15)' : 'none',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'background 0.2s'
                          }}
                          title={copiedField?.id === r.id && copiedField?.type === 'email' ? 'Copied!' : 'Copy email'}
                        >
                          {copiedField?.id === r.id && copiedField?.type === 'email' ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#006633" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
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
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(r.created_at)}
                  </td>
                  <td>{r.cinema_code}</td>
                  <td>{r.quantity}</td>
                  <td>{formatCurrency(r.total_amount)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.gcash_ref}</td>
                  <td>
                    {r.gcash_verified ? (
                      <span style={{ color: '#047857' }}>Verified</span>
                    ) : (
                      gcashMatches[r.id] === 'match' ? (
                        <span style={{ color: '#047857', fontWeight: 600 }}>Match</span>
                      ) : gcashMatches[r.id] === 'partial_match' ? (
                        <span style={{ color: '#0369a1', fontWeight: 600 }}>Partial match</span>
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
                            background: copiedField?.id === r.id && copiedField?.type === 'ticket' ? 'rgba(0, 102, 51, 0.15)' : 'none',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s'
                          }}
                          title={copiedField?.id === r.id && copiedField?.type === 'ticket' ? 'Copied!' : 'Copy ticket numbers'}
                          aria-label={copiedField?.id === r.id && copiedField?.type === 'ticket' ? 'Copied!' : 'Copy ticket numbers'}
                        >
                          {copiedField?.id === r.id && copiedField?.type === 'ticket' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#006633" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          )}
                        </button>
                        {r.quantity >= 20 && hasEditAccess && (
                          r.seats_selected_at ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                              Seats reserved
                            </span>
                          ) : (
                            <button
                              onClick={() => handleGenerateSeatLink(r.id)}
                              disabled={actionLoading[r.id] === 'seatlink'}
                              style={{
                                background: copiedField?.id === r.id && copiedField?.type === 'seatlink' ? 'rgba(207, 181, 59, 0.15)' : 'rgba(207, 181, 59, 0.08)',
                                border: '1px solid rgba(207, 181, 59, 0.3)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#CFB53B',
                                transition: 'background 0.2s',
                                opacity: actionLoading[r.id] === 'seatlink' ? 0.6 : 1
                              }}
                              title={copiedField?.id === r.id && copiedField?.type === 'seatlink' ? 'Link copied!' : 'Generate seat picker link'}
                            >
                              {actionLoading[r.id] === 'seatlink' ? '...' : (
                                copiedField?.id === r.id && copiedField?.type === 'seatlink' ? (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CFB53B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CFB53B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                    </svg>
                                    Seat link
                                  </>
                                )
                              )}
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td>
                    {r.chosen_seats ? (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          maxWidth: '120px',
                          display: 'inline-block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={r.chosen_seats}
                      >
                        {r.chosen_seats}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                    )}
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      hasEditAccess ? (
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
                      ) : (
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        background: 'rgba(180, 83, 9, 0.1)',
                        color: '#b45309'
                      }}>
                        Pending
                      </span>
                      )
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
                  <td>
                    {r.status === 'confirmed' ? (
                      hasEditAccess ? (
                        <button
                          onClick={() => handleToggleClaimed(r.id)}
                          disabled={actionLoading[r.id] === 'claim'}
                          style={{
                            background: r.claimed ? 'rgba(4, 120, 87, 0.1)' : 'transparent',
                            border: r.claimed ? '1px solid #047857' : '1px solid var(--color-text-secondary)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: actionLoading[r.id] === 'claim' ? 0.6 : 1
                          }}
                          title={r.claimed && r.claimed_by_name ? `Claimed by ${r.claimed_by_name} at ${formatDate(r.claimed_at)}` : 'Click to mark as claimed'}
                        >
                          {r.claimed ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            </svg>
                          )}
                          <span style={{ fontSize: '0.8rem', color: r.claimed ? '#047857' : 'var(--color-text-secondary)' }}>
                            {actionLoading[r.id] === 'claim' ? '...' : (r.claimed ? 'Yes' : 'No')}
                          </span>
                        </button>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: r.claimed ? '#047857' : 'var(--color-text-secondary)'
                          }}
                          title={r.claimed && r.claimed_by_name ? `Claimed by ${r.claimed_by_name} at ${formatDate(r.claimed_at)}` : ''}
                        >
                          {r.claimed ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : null}
                          {r.claimed ? 'Yes' : 'No'}
                        </span>
                      )
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
