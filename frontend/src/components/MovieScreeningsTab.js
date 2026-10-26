import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { apiGet, apiPost, apiPatch } from '../api';
import { formatName } from '../utils/formatName';
// Use pdfjs-dist/webpack which auto-configures the worker using import.meta.url
// This bundles the worker locally so it never depends on a CDN
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';

// Doomsday milestone constants
const TOTAL_CAPACITY = 615;
const MILESTONE_CINEMA = 323;             // Cinema paid
const MILESTONE_BREAKEVEN = 406;          // Break-even (cinema + food + Liceo)
const MILESTONE_SELLOUT = 615;            // Sellout
const CINEMA_DUE_DATE = 'Dec 11';
const CINEMA_AMOUNT = 193590;
const BREAKEVEN_AMOUNT = 243150;
const SELLOUT_NET = 105850;

// Liceo partnership tiers
const LICEO_TIER_50 = 308;                // 50% = ₱20,000
const LICEO_TIER_75 = 462;                // 75% = ₱35,000
const LICEO_TIER_100 = 615;               // 100% = ₱40,000

export default function MovieScreeningsTab({ permissions = {}, isSuperAdmin = false }) {
  // Determine access level from permissions
  // Super admin has all access; otherwise check specific permissions
  const hasTrackerAccess = isSuperAdmin || permissions.screenings_tracker || permissions.screenings_edit;
  const hasEditAccess = isSuperAdmin || permissions.screenings_edit;
  const hasStatsAccess = isSuperAdmin || permissions.screenings_stats || permissions.screenings_tracker || permissions.screenings_edit;
  const [event, setEvent] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [stats, setStats] = useState(null);
  const [showtimes, setShowtimes] = useState([]);
  const [byTeam, setByTeam] = useState({ batch2003: null, liceo: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // GCash PDF matching state
  const [gcashMatches, setGcashMatches] = useState({});
  const [gcashParsing, setGcashParsing] = useState(false);
  const fileInputRef = useRef(null);

  // Copy feedback state: tracks which field was just copied { id, type }
  const [copiedField, setCopiedField] = useState(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState(null); // { reservation, ticketNumbers, gcashStatus }
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Stubs CSV export dropdown state
  const [stubsMenuOpen, setStubsMenuOpen] = useState(false);
  const stubsMenuRef = useRef(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme-aware accent colors for gold/green elements
  const accentColor = isDark ? '#CFB53B' : '#006633';

  useEffect(() => {
    fetchActiveEvent();
  }, []);

  // Close stubs menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (stubsMenuRef.current && !stubsMenuRef.current.contains(e.target)) {
        setStubsMenuOpen(false);
      }
    };
    if (stubsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [stubsMenuOpen]);

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
        setStats(data.stats || null);
        setShowtimes(data.showtimes || []);
        setByTeam(data.by_team || { batch2003: null, liceo: null });
      } else {
        // Stats-only access
        const res = await apiGet(`/api/movie-screening/admin/stats?event_id=${eventId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load stats');
          return;
        }

        setReservations([]); // No reservation data for stats-only users
        setStats(data.stats || null);
        setShowtimes(data.showtimes || []);
        setByTeam(data.by_team || { batch2003: null, liceo: null });
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

      // Find the reservation row for modal display
      const row = reservations.find(r => r.id === id);
      const gcashStatus = gcashMatches[id] || null;

      // Open confirmation modal
      setConfirmModal({
        reservation: { ...row, ...data },
        ticketNumbers: data.ticket_numbers,
        gcashStatus
      });
      setEmailSent(false);
      setEmailError('');

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

  const handleMarkAudited = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'audit' }));
    try {
      const res = await apiPost(`/api/movie-screening/admin/${id}/mark-audited`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to mark as audited');
        return;
      }

      // Update reservation in state
      setReservations(prev => prev.map(r => r.id === id ? { ...r, gcash_verified: data.gcash_verified } : r));
    } catch (err) {
      console.error(err);
      alert('Failed to mark as audited');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  // Send confirmation email from modal
  const handleSendEmail = async (reservationId, email) => {
    setEmailSending(true);
    setEmailError('');
    try {
      const res = await apiPost(`/api/movie-screening/admin/${reservationId}/send-confirmation`);
      const data = await res.json();

      if (!res.ok || data.email_sent === false) {
        setEmailError(data.error || 'Failed to send email');
        return;
      }

      setEmailSent(true);
      // Update reservation in local state with sent timestamp
      setReservations(prev => prev.map(r =>
        r.id === reservationId ? { ...r, confirmation_email_sent_at: data.confirmation_email_sent_at } : r
      ));
    } catch (err) {
      console.error(err);
      setEmailError('Failed to send email');
    } finally {
      setEmailSending(false);
    }
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
    const range = reservation.ticket_numbers || '-';
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

  // Format date for email sent timestamp (e.g., "Dec 18, 3:45 PM")
  const formatShortDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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
    const headers = ['buyer_name', 'mobile', 'email', 'purchased', 'showtime', 'quantity', 'unit_price', 'total_amount', 'gcash_ref', 'status', 'chosen_seats', 'ticket_numbers', 'sold_by_team', 'claimed', 'claimed_at', 'source', 'sold_by', 'payment_method', 'audited', 'emailed'];
    const rows = reservations.map(r => [
      formatName(r.buyer_name),
      r.mobile || '',
      r.email || '',
      formatDate(r.created_at),
      `${r.showtime || ''} · ${r.serial_prefix || r.cinema_code}`,
      r.quantity,
      r.unit_price,
      r.total_amount,
      r.gcash_ref,
      r.status,
      r.chosen_seats || '',
      r.ticket_numbers || '',
      r.sold_by_team === 'liceo' ? 'Liceo' : 'Batch 2003',
      r.claimed ? 'Yes' : 'No',
      r.claimed_at ? formatDate(r.claimed_at) : '',
      r.source || 'online',
      r.sold_by || '',
      r.payment_method || '',
      r.source === 'physical' ? (r.gcash_verified ? 'Yes' : 'No') : '',
      r.confirmation_email_sent_at ? 'Yes' : 'No'
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

  // Helper to escape CSV cell values (prevent formula injection)
  const escapeCsvCell = (value) => {
    const str = String(value);
    if (str.length > 0 && /^[=+\-@]/.test(str)) {
      return "'" + str;
    }
    return str;
  };

  // Export stubs CSV for a specific showtime
  const exportStubsCSV = async (showtime) => {
    setStubsMenuOpen(false);
    try {
      const res = await apiGet(`/api/movie-screening/admin/stubs?event_id=${event.id}&cinema_code=${showtime.code}`);
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to fetch stubs data');
        return;
      }

      const headers = ['Stub #', 'Seat', 'Buyer name', 'Sold by'];
      const rows = data.rows.map(r => [
        escapeCsvCell(r.stub),
        escapeCsvCell(r.seat),
        escapeCsvCell(r.buyer_name ? formatName(r.buyer_name) : ''),
        escapeCsvCell(r.sold_by)
      ]);

      const csvContent = [
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Format filename: Doomsday_Stubs_{showtime with ":" -> "."}_{label}.csv
      const showtimeForFilename = data.showtime.replace(/:/g, '.');
      link.download = `Doomsday_Stubs_${showtimeForFilename}_${data.label}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export stubs CSV');
    }
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
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {stats.tickets_pending || 0} tickets
            </div>
          </div>
          <div className="stat-card going">
            <div className="stat-number">{stats.confirmed_count}</div>
            <div className="stat-label">Confirmed</div>
          </div>
          <div className="stat-card going">
            <div className="stat-number">{stats.tickets_sold || 0}</div>
            <div className="stat-label">Tickets Sold</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {showtimes.map((s, i) => (
                <span key={s.code}>
                  {i > 0 && ' · '}
                  {s.showtime} {s.tickets_sold}
                </span>
              ))}
            </div>
          </div>
          <div className="stat-card" style={{ background: isDark ? 'rgba(207, 181, 59, 0.1)' : 'rgba(0, 102, 51, 0.1)' }}>
            <div className="stat-number stat-number--currency" style={{ color: accentColor }}>{formatCurrency(stats.total_collected)}</div>
            <div className="stat-label">Collected</div>
          </div>
        </div>
      )}

      {/* Sold by Panel */}
      {stats && (byTeam.batch2003 || byTeam.liceo) && (
        <div className="ms-milestones-card" style={{ marginBottom: '24px' }}>
          <div className="ms-header">
            <span className="ms-title">Sold by</span>
            <span className="ms-summary">Confirmed tickets only</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Batch 2003 Card */}
            <div style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>USLS-IS BATCH 2003</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{byTeam.batch2003?.tickets || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                tickets · {stats.tickets_sold > 0 ? Math.round(((byTeam.batch2003?.tickets || 0) / stats.tickets_sold) * 100) : 0}% of sales
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                {byTeam.batch2003?.per_showtime?.map(ps => (
                  <span key={ps.code}>{ps.showtime} {ps.tickets}</span>
                ))}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                {byTeam.batch2003?.orders || 0} orders · {formatCurrency(byTeam.batch2003?.collected || 0)} collected
              </div>
            </div>

            {/* Liceo Card */}
            <div style={{ background: isDark ? 'rgba(93,168,116,0.12)' : 'rgba(0,102,51,0.05)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isDark ? '#5DA874' : '#006633', marginBottom: '8px' }}>LICEO STUDENT GOVERNMENT</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: isDark ? '#5DA874' : '#006633' }}>{byTeam.liceo?.tickets || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                tickets · {stats.tickets_sold > 0 ? Math.round(((byTeam.liceo?.tickets || 0) / stats.tickets_sold) * 100) : 0}% of sales
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                {byTeam.liceo?.per_showtime?.map(ps => (
                  <span key={ps.code}>{ps.showtime} {ps.tickets}</span>
                ))}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                {byTeam.liceo?.orders || 0} orders · {formatCurrency(byTeam.liceo?.collected || 0)} collected
              </div>
            </div>
          </div>

          {/* Split bar */}
          {(() => {
            const b2003 = byTeam.batch2003?.tickets || 0;
            const liceo = byTeam.liceo?.tickets || 0;
            const total = b2003 + liceo;
            const b2003Pct = total > 0 ? (b2003 / total) * 100 : 50;
            const diff = Math.abs(b2003 - liceo);
            const leadText = b2003 > liceo ? `Batch 2003 ahead by ${diff}` : liceo > b2003 ? `Liceo ahead by ${diff}` : 'Tied';

            return (
              <div>
                <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${b2003Pct}%`, background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
                  <div style={{ width: `${100 - b2003Pct}%`, background: isDark ? '#5DA874' : '#006633' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                  <span>Batch 2003 {b2003}</span>
                  <span>{leadText}</span>
                  <span>Liceo {liceo}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Seat Bars */}
      {showtimes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-primary)' }}>
            Seat Availability
          </h4>
          {showtimes.map((s) => {
            const percentage = s.capacity > 0 ? (s.held_seats / s.capacity) * 100 : 0;
            return (
              <div key={s.code} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
                    {s.showtime}
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>· {s.label}</span>
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {s.held_seats} / {s.capacity} held
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
          const ticketsSold = stats.tickets_sold || 0;
          const percentage = Math.min((ticketsSold / TOTAL_CAPACITY) * 100, 100);

          const cinemaHit = ticketsSold >= MILESTONE_CINEMA;
          const breakevenHit = ticketsSold >= MILESTONE_BREAKEVEN;
          const selloutHit = ticketsSold >= MILESTONE_SELLOUT;

          const remainingCinema = Math.max(0, MILESTONE_CINEMA - ticketsSold);
          const remainingBreakeven = Math.max(0, MILESTONE_BREAKEVEN - ticketsSold);
          const remainingSellout = Math.max(0, MILESTONE_SELLOUT - ticketsSold);

          // Determine next milestone for footer
          let footerText = '';
          if (selloutHit) {
            footerText = 'Sold out!';
          } else if (breakevenHit) {
            footerText = `${remainingSellout} remaining for sellout`;
          } else if (cinemaHit) {
            footerText = `${remainingBreakeven} remaining for break-even`;
          } else {
            footerText = `${remainingCinema} remaining for cinema payment`;
          }

          return (
            <div className="ms-milestones-card">
              <div className="ms-header">
                <span className="ms-title">Milestones</span>
                <span className="ms-summary">
                  {ticketsSold} / {TOTAL_CAPACITY} tickets sold · {percentage.toFixed(1)}%
                </span>
              </div>

              <div className="ms-progress-container">
                <div className="ms-progress-bar">
                  <div className="ms-progress-fill" style={{ width: `${percentage}%` }} />
                  <div className="ms-marker" style={{ left: `${(MILESTONE_CINEMA / TOTAL_CAPACITY) * 100}%` }} />
                  <div className="ms-marker" style={{ left: `${(MILESTONE_BREAKEVEN / TOTAL_CAPACITY) * 100}%` }} />
                </div>
                <div className="ms-tick-labels">
                  <span style={{ left: `${(MILESTONE_CINEMA / TOTAL_CAPACITY) * 100}%` }}>{MILESTONE_CINEMA}</span>
                  <span style={{ left: `${(MILESTONE_BREAKEVEN / TOTAL_CAPACITY) * 100}%` }}>{MILESTONE_BREAKEVEN}</span>
                  <span style={{ left: '100%' }}>{TOTAL_CAPACITY}</span>
                </div>
              </div>

              <div className="ms-legend">
                <div className="ms-legend-row ms-red">
                  <span className="ms-legend-number">{MILESTONE_CINEMA}</span>
                  <span className="ms-legend-desc">Cinema paid (₱{CINEMA_AMOUNT.toLocaleString()} due {CINEMA_DUE_DATE})</span>
                  <span className="ms-legend-status">
                    {cinemaHit ? <span className="ms-done">Reached</span> : `${remainingCinema} to go`}
                  </span>
                </div>
                <div className="ms-legend-row ms-gold">
                  <span className="ms-legend-number">{MILESTONE_BREAKEVEN}</span>
                  <span className="ms-legend-desc">Break-even, cinema, food, and Liceo covered (₱{BREAKEVEN_AMOUNT.toLocaleString()})</span>
                  <span className="ms-legend-status">
                    {breakevenHit ? <span className="ms-done">Reached</span> : `${remainingBreakeven} to go`}
                  </span>
                </div>
                <div className="ms-legend-row ms-green">
                  <span className="ms-legend-number">{MILESTONE_SELLOUT}</span>
                  <span className="ms-legend-desc">Sellout, ₱{SELLOUT_NET.toLocaleString()} net from tickets</span>
                  <span className="ms-legend-status">
                    {selloutHit ? <span className="ms-done">Reached</span> : `${remainingSellout} to go`}
                  </span>
                </div>
              </div>

              <div className="ms-pace">
                {selloutHit ? <span className="ms-done">🎉 Sold out!</span> : footerText}
              </div>
            </div>
          );
        })()
      )}

      {/* Liceo Partnership Panel */}
      {stats && (
        (() => {
          const ticketsSold = stats.tickets_sold || 0;
          const pct = Math.round((ticketsSold / TOTAL_CAPACITY) * 100);
          const tier50Hit = ticketsSold >= LICEO_TIER_50;
          const tier75Hit = ticketsSold >= LICEO_TIER_75;
          const tier100Hit = ticketsSold >= LICEO_TIER_100;
          const earnedAmount = tier100Hit ? 40000 : tier75Hit ? 35000 : tier50Hit ? 20000 : 0;
          const nextTier = !tier50Hit ? { amount: 20000, at: LICEO_TIER_50 } : !tier75Hit ? { amount: 35000, at: LICEO_TIER_75 } : !tier100Hit ? { amount: 40000, at: LICEO_TIER_100 } : null;

          return (
            <div className="ms-milestones-card">
              <div className="ms-header">
                <div>
                  <span className="ms-title">Liceo Partnership</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Collective sales, Batch 2003 + Liceo combined</div>
                </div>
                <span className="ms-summary">{ticketsSold} / {TOTAL_CAPACITY} tickets · {pct}%</span>
              </div>

              <div className="ms-progress-container">
                <div className="ms-progress-bar">
                  <div className="ms-progress-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
                  <div className="ms-marker" style={{ left: `${(LICEO_TIER_50 / TOTAL_CAPACITY) * 100}%` }} />
                  <div className="ms-marker" style={{ left: `${(LICEO_TIER_75 / TOTAL_CAPACITY) * 100}%` }} />
                </div>
                <div className="ms-tick-labels">
                  <span style={{ left: `${(LICEO_TIER_50 / TOTAL_CAPACITY) * 100}%` }}>{LICEO_TIER_50}</span>
                  <span style={{ left: `${(LICEO_TIER_75 / TOTAL_CAPACITY) * 100}%` }}>{LICEO_TIER_75}</span>
                  <span style={{ left: '100%' }}>{TOTAL_CAPACITY}</span>
                </div>
              </div>

              <div className="ms-legend">
                <div className="ms-legend-row ms-red">
                  <span className="ms-legend-number">{LICEO_TIER_50}</span>
                  <span className="ms-legend-desc">50% sold · ₱20,000 to Liceo</span>
                  <span className="ms-legend-status">{tier50Hit ? <span className="ms-done">Reached</span> : `${LICEO_TIER_50 - ticketsSold} to go`}</span>
                </div>
                <div className="ms-legend-row ms-gold">
                  <span className="ms-legend-number">{LICEO_TIER_75}</span>
                  <span className="ms-legend-desc">75% sold · ₱35,000 to Liceo</span>
                  <span className="ms-legend-status">{tier75Hit ? <span className="ms-done">Reached</span> : `${LICEO_TIER_75 - ticketsSold} to go`}</span>
                </div>
                <div className="ms-legend-row ms-green">
                  <span className="ms-legend-number">{LICEO_TIER_100}</span>
                  <span className="ms-legend-desc">100% sell-out · ₱40,000 to Liceo</span>
                  <span className="ms-legend-status">{tier100Hit ? <span className="ms-done">Reached</span> : `${LICEO_TIER_100 - ticketsSold} to go`}</span>
                </div>
              </div>

              <div className="ms-pace">
                Contribution earned so far: {formatCurrency(earnedAmount)}
                {nextTier && ` · next: ${formatCurrency(nextTier.amount)} at ${nextTier.at}`}
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                Tiers are not cumulative. Highest tier reached counts, ₱40,000 maximum. Verified, paid sales only.
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
        {hasTrackerAccess && (
        <div ref={stubsMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={() => setStubsMenuOpen(!stubsMenuOpen)}
            className="btn-secondary"
            style={{ padding: '10px 16px', fontSize: '0.85rem' }}
          >
            Export stubs CSV ▾
          </button>
          {stubsMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: isDark ? '#2a2a2a' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 100,
              minWidth: '180px',
              overflow: 'hidden'
            }}>
              {showtimes.map(s => (
                <button
                  key={s.code}
                  onClick={() => exportStubsCSV(s)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'var(--color-text-primary)',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
                  }}
                  onMouseEnter={e => e.target.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                  onMouseLeave={e => e.target.style.background = 'none'}
                >
                  {s.showtime} · {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        {hasTrackerAccess && (
        <Link
          to="/admin/seats"
          className="btn-secondary"
          style={{ padding: '10px 16px', fontSize: '0.85rem', textDecoration: 'none' }}
        >
          View Seat Map
        </Link>
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
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
        <table className="admin-table" style={{ minWidth: '900px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th>Buyer</th>
              <th>Purchased</th>
              <th>Showtime</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>GCash Ref</th>
              <th>GCash Check</th>
              <th>Ticket Numbers</th>
              <th>Seats</th>
              <th>Sold By</th>
              <th>Status/Action</th>
              <th>Email</th>
              <th>Claimed</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
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
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{formatName(r.buyer_name)}</div>
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
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {formatDate(r.created_at)}
                  </td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {r.showtime} · {r.serial_prefix || r.cinema_code}
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
                    {r.ticket_numbers ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {r.ticket_numbers}
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
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      background: r.sold_by_team === 'liceo'
                        ? (isDark ? 'rgba(93,168,116,0.15)' : 'rgba(0,102,51,0.1)')
                        : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                      color: r.sold_by_team === 'liceo'
                        ? (isDark ? '#5DA874' : '#006633')
                        : 'var(--color-text-secondary)'
                    }}>
                      {r.sold_by_team === 'liceo' ? 'Liceo' : 'Batch 2003'}
                    </span>
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
                      <div>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          background: r.source === 'physical' ? 'rgba(207, 181, 59, 0.15)' : 'rgba(4, 120, 87, 0.1)',
                          color: r.source === 'physical' ? '#CFB53B' : '#047857'
                        }}>
                          {r.source === 'physical' ? 'Verified - Onsite' : 'Confirmed'}
                        </span>
                        {r.source === 'physical' && r.sold_by && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            Sold by {r.sold_by}
                          </div>
                        )}
                        {r.source === 'physical' && (
                          r.gcash_verified ? (
                            <span style={{
                              display: 'inline-block',
                              marginTop: '6px',
                              padding: '3px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              borderRadius: '4px',
                              background: 'rgba(4, 120, 87, 0.1)',
                              color: '#047857'
                            }}>
                              Audited
                            </span>
                          ) : hasEditAccess && (
                            <button
                              onClick={() => handleMarkAudited(r.id)}
                              disabled={actionLoading[r.id]}
                              style={{
                                display: 'block',
                                marginTop: '6px',
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                background: 'rgba(207, 181, 59, 0.15)',
                                color: '#CFB53B',
                                border: '1px solid rgba(207, 181, 59, 0.3)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                opacity: actionLoading[r.id] === 'audit' ? 0.6 : 1
                              }}
                            >
                              {actionLoading[r.id] === 'audit' ? 'Marking...' : 'Mark audited'}
                            </button>
                          )
                        )}
                      </div>
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
                      r.confirmation_email_sent_at ? (
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            background: isDark ? '#1E3A28' : '#E3F2E8',
                            color: isDark ? '#8FD3A1' : '#1E6B3A'
                          }}>
                            ✓ Emailed
                          </span>
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {formatShortDate(r.confirmation_email_sent_at)}
                          </div>
                          {hasEditAccess && (
                            <button
                              onClick={() => {
                                setConfirmModal({ reservation: r, ticketNumbers: r.ticket_numbers, gcashStatus: gcashMatches[r.id] || null });
                                setEmailSent(false);
                                setEmailError('');
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                marginTop: '2px',
                                fontSize: '0.65rem',
                                color: accentColor,
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              Resend
                            </button>
                          )}
                        </div>
                      ) : r.email ? (
                        hasEditAccess ? (
                          <button
                            onClick={() => {
                              setConfirmModal({ reservation: r, ticketNumbers: r.ticket_numbers, gcashStatus: gcashMatches[r.id] || null });
                              setEmailSent(false);
                              setEmailError('');
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: 'transparent',
                              border: `1.5px solid ${accentColor}`,
                              borderRadius: '6px',
                              color: accentColor,
                              cursor: 'pointer'
                            }}
                          >
                            Send email
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>Not sent</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>No email</span>
                      )
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)' }}>-</span>
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

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: isDark ? '#1a1a1a' : '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
              Payment confirmed
            </h3>

            <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Buyer name:</span>{' '}
                <strong>{formatName(confirmModal.reservation.buyer_name)}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Email:</span>{' '}
                <strong>{confirmModal.reservation.email || 'None'}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Showtime:</span>{' '}
                <strong>{confirmModal.reservation.cinema_label || confirmModal.reservation.serial_prefix} · {confirmModal.reservation.showtime}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tickets:</span>{' '}
                <strong>{confirmModal.reservation.quantity}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Seats:</span>{' '}
                <strong>{confirmModal.reservation.chosen_seats || '-'}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Ticket numbers:</span>{' '}
                <strong style={{ fontFamily: 'monospace' }}>{confirmModal.ticketNumbers || '-'}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Amount:</span>{' '}
                <strong>{formatCurrency(confirmModal.reservation.total_amount)}</strong>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>GCash ref:</span>{' '}
                <strong style={{ fontFamily: 'monospace' }}>{confirmModal.reservation.gcash_ref}</strong>
              </div>
              {confirmModal.gcashStatus && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>GCash check:</span>{' '}
                  <strong style={{
                    color: confirmModal.gcashStatus === 'match' ? '#047857' :
                           confirmModal.gcashStatus === 'partial_match' ? '#0369a1' :
                           confirmModal.gcashStatus === 'amount_off' ? '#b45309' : '#b91c1c'
                  }}>
                    {confirmModal.gcashStatus === 'match' ? 'Match' :
                     confirmModal.gcashStatus === 'partial_match' ? 'Partial match' :
                     confirmModal.gcashStatus === 'amount_off' ? 'Amount off' : 'Not found'}
                  </strong>
                </div>
              )}
            </div>

            {emailError && (
              <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(185, 28, 28, 0.1)', borderRadius: '6px', color: '#b91c1c', fontSize: '0.85rem' }}>
                {emailError}
              </div>
            )}

            {emailSent ? (
              <div style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '16px', color: '#047857', fontWeight: 500 }}>
                  Email sent to {confirmModal.reservation.email}.
                </div>
                <button onClick={() => setConfirmModal(null)} className="btn-primary" style={{ width: '100%' }}>
                  Done
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                {confirmModal.reservation.email ? (
                  <button
                    onClick={() => handleSendEmail(confirmModal.reservation.id, confirmModal.reservation.email)}
                    disabled={emailSending}
                    className="btn-primary"
                    style={{ flex: 1, opacity: emailSending ? 0.6 : 1 }}
                  >
                    {emailSending ? 'Sending...' : 'Send email'}
                  </button>
                ) : (
                  <div style={{ flex: 1, padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    No email on this order.
                  </div>
                )}
                <button
                  onClick={() => setConfirmModal(null)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  {confirmModal.reservation.email ? 'Not now' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
