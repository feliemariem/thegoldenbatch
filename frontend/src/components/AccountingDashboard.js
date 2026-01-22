import { useState, useEffect, useRef, useCallback } from 'react';
import ScrollableTable from './ScrollableTable';
import { API_URL } from '../config';

export default function AccountingDashboard({ token, canEdit = true, canExport = true, onPaymentLinked }) {
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [stats, setStats] = useState({ transactionCount: 0, depositCount: 0, withdrawalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [transactionType, setTransactionType] = useState('deposit');
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    name: '',
    description: '',
    amount: '',
    reference_no: '',
    verified: 'Pending',
    payment_type: '',
    master_list_id: null
  });
  const [result, setResult] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Form ref for scrolling
  const formRef = useRef(null);
  const tableRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Receipt states
  const [uploadingReceipt, setUploadingReceipt] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  // Master list linking states
  const [masterListOptions, setMasterListOptions] = useState([]);
  const [linkingTransaction, setLinkingTransaction] = useState(null);
  const [linkSearch, setLinkSearch] = useState('');

  // Autocomplete names from existing ledger entries
  const [existingNames, setExistingNames] = useState([]);

  // Fetch transactions with pagination
  const fetchTransactions = useCallback(async (pageNum = 1, search = '', type = 'all') => {
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '45',
      });
      if (search.trim()) params.append('search', search.trim());
      if (type !== 'all') params.append('type', type);

      const res = await fetch(`${API_URL}/api/ledger?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTransactions(data.transactions || []);
      setBalance(data.balance || 0);
      setTotalDeposits(data.totalDeposits || 0);
      setTotalWithdrawals(data.totalWithdrawals || 0);
      setPendingDeposits(data.pendingDeposits || 0);
      setPendingWithdrawals(data.pendingWithdrawals || 0);
      setStats(data.stats || { transactionCount: 0, depositCount: 0, withdrawalCount: 0 });
      setPage(data.pagination?.currentPage || 1);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
    } catch (err) {
      console.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTransactions(1, searchFilter, typeFilter);
    fetchMasterListOptions();
    fetchExistingNames();
  }, [token]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchTransactions(1, searchFilter, typeFilter);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchFilter, typeFilter]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchTransactions(newPage, searchFilter, typeFilter);
      scrollToTable();
    }
  };

  const scrollToTable = () => {
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const refreshTransactions = () => {
    fetchTransactions(page, searchFilter, typeFilter);
  };

  const fetchMasterListOptions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ledger/master-list-options`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMasterListOptions(data || []);
    } catch (err) {
      console.error('Failed to fetch master list options');
    }
  };


  const fetchExistingNames = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ledger/donors`);
      const data = await res.json();
      setExistingNames(data.donors || []);
    } catch (err) {
      console.error('Failed to fetch existing names');
    }
  };

  const resetForm = () => {
    setForm({
      transaction_date: new Date().toISOString().split('T')[0],
      name: '',
      description: '',
      amount: '',
      reference_no: '',
      verified: 'Pending',
      payment_type: '',
      master_list_id: null
    });
    setTransactionType('deposit');
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const payload = {
      transaction_date: form.transaction_date,
      name: form.name,
      description: form.description,
      deposit: transactionType === 'deposit' ? form.amount : null,
      withdrawal: transactionType === 'withdrawal' ? form.amount : null,
      reference_no: form.reference_no,
      verified: form.verified,
      payment_type: form.payment_type || null,
      master_list_id: form.master_list_id
    };

    try {
      const url = editingId 
        ? `${API_URL}/api/ledger/${editingId}`
        : `${API_URL}/api/ledger`;
      
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setResult({ success: true, message: editingId ? 'Transaction updated!' : 'Transaction added!' });
        resetForm();
        refreshTransactions();
        fetchExistingNames(); // Refresh autocomplete list
      } else {
        const data = await res.json();
        setResult({ success: false, message: data.error || 'Failed to save' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Failed to save transaction' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (transaction) => {
    const isDeposit = transaction.deposit !== null && transaction.deposit > 0;
    setTransactionType(isDeposit ? 'deposit' : 'withdrawal');
    setForm({
      transaction_date: transaction.transaction_date?.split('T')[0] || '',
      name: transaction.name || '',
      description: transaction.description || '',
      amount: isDeposit ? transaction.deposit : transaction.withdrawal,
      reference_no: transaction.reference_no || '',
      verified: transaction.verified || 'Pending',
      payment_type: transaction.payment_type || '',
      master_list_id: transaction.master_list_id || null
    });
    setEditingId(transaction.id);
    setShowForm(true);
    
    // Scroll to form after it renders
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;

    try {
      const res = await fetch(`${API_URL}/api/ledger/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        refreshTransactions();
      }
    } catch (err) {
      console.error('Failed to delete');
    }
  };

  // Link/Unlink handlers
  const handleLink = async (transactionId, masterListId) => {
    try {
      const res = await fetch(`${API_URL}/api/ledger/${transactionId}/link`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ master_list_id: masterListId })
      });

      if (res.ok) {
        refreshTransactions();
        setLinkingTransaction(null);
        setLinkSearch('');
        onPaymentLinked?.();
      }
    } catch (err) {
      console.error('Failed to link');
    }
  };

  const handleUnlink = async (transactionId) => {
    try {
      const res = await fetch(`${API_URL}/api/ledger/${transactionId}/unlink`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        refreshTransactions();
        onPaymentLinked?.();
      }
    } catch (err) {
      console.error('Failed to unlink');
    }
  };

  // Receipt upload handlers
  const handleReceiptUpload = async (transactionId, file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setUploadingReceipt(transactionId);

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await fetch(`${API_URL}/api/ledger/${transactionId}/receipt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        refreshTransactions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to upload receipt');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload receipt');
    } finally {
      setUploadingReceipt(null);
      setDragOver(null);
    }
  };

  const handleDeleteReceipt = async (transactionId) => {
    if (!window.confirm('Delete this receipt?')) return;

    try {
      const res = await fetch(`${API_URL}/api/ledger/${transactionId}/receipt`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setViewingReceipt(null);
        refreshTransactions();
      }
    } catch (err) {
      console.error('Failed to delete receipt');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e, transactionId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(transactionId);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
  };

  const handleDrop = (e, transactionId) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleReceiptUpload(transactionId, file);
    }
    setDragOver(null);
  };

  const formatCurrency = (amount) => {
    return 'P' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToCSV = async () => {
    try {
      // Fetch all transactions for export (no pagination)
      const res = await fetch(`${API_URL}/api/ledger?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const allTransactions = data.transactions || [];

      if (!allTransactions.length) return;

      // Title and timestamp
      const now = new Date();
      const timestamp = now.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const title = ['USLS-IS Batch 2003 - Golden Batch Ledger'];
      const exportDate = [`Exported: ${timestamp}`];
      const blankRow = [''];

      const headers = ['Date', 'Name', 'Description', 'Deposit', 'Withdrawal', 'Balance', 'Reference No.', 'Verified', 'Payment Type', 'Recorded By', 'Receipt URL'];
      const rows = allTransactions.map(t => [
        t.transaction_date ? new Date(t.transaction_date.split('T')[0] + 'T00:00:00').toLocaleDateString() : '',
        t.name || '',
        t.description || '',
        t.deposit || '',
        t.withdrawal || '',
        t.balance || 0,
        t.reference_no || '',
        t.verified || '',
        t.payment_type || '',
        t.recorded_by || '',
        t.receipt_url || ''
      ]);

      const csv = [title, exportDate, blankRow, headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'usls-batch-2003-ledger.csv';
      a.click();
    } catch (err) {
      console.error('Failed to export ledger');
    }
  };

  // Filter master list options for linking
  const filteredMasterListOptions = masterListOptions.filter(m => {
    const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
    return fullName.includes(linkSearch.toLowerCase());
  });

  if (loading) {
    return <p style={{ color: '#999' }}>Loading transactions...</p>;
  }

  return (
    <div>
      <h3>Accounting Dashboard</h3>
      <p style={{ color: '#999', marginBottom: '24px' }}>Track funds for the reunion.</p>

      {/* Summary Cards - Only verified (OK) transactions are counted */}
      <div className="ledger-summary">
        <div className="ledger-summary-card deposits">
          <p className="ledger-summary-label">Total Deposits</p>
          <p className="ledger-summary-value">{formatCurrency(totalDeposits)}</p>
          {pendingDeposits > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-status-warning)', marginTop: '4px' }}>
              +{formatCurrency(pendingDeposits)} pending
            </p>
          )}
        </div>
        <div className="ledger-summary-card withdrawals">
          <p className="ledger-summary-label">Total Withdrawals</p>
          <p className="ledger-summary-value">{formatCurrency(totalWithdrawals)}</p>
          {pendingWithdrawals > 0 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-status-warning)', marginTop: '4px' }}>
              +{formatCurrency(pendingWithdrawals)} pending
            </p>
          )}
        </div>
        <div className="ledger-summary-card balance">
          <p className="ledger-summary-label">Current Balance</p>
          <p className="ledger-summary-value">{formatCurrency(balance)}</p>
          <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
            Verified only
          </p>
        </div>
      </div>

      {/* Info banner about pending transactions */}
      {(pendingDeposits > 0 || pendingWithdrawals > 0) && (
        <div className="pending-notice">
          Pending transactions are shown in the table but excluded from totals until verified (OK).
        </div>
      )}

      {/* Add Transaction Button / Form */}
      {!showForm ? (
        canEdit && (
          <button 
            onClick={() => setShowForm(true)} 
            className="btn-primary"
            style={{ marginBottom: '24px', width: 'auto', padding: '12px 24px' }}
          >
            + Add Transaction
          </button>
        )
      ) : (
        <div className="invite-section" ref={formRef} style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '16px' }}>{editingId ? 'Edit Transaction' : 'Add New Transaction'}</h4>
          <form onSubmit={handleSubmit}>
            {/* Transaction Type Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setTransactionType('deposit')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  background: transactionType === 'deposit' ? 'var(--color-status-positive-bg)' : 'rgba(255,255,255,0.05)',
                  color: transactionType === 'deposit' ? 'var(--color-status-positive)' : '#888'
                }}
              >
                + Deposit
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('withdrawal')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  background: transactionType === 'withdrawal' ? 'var(--color-status-negative-bg)' : 'rgba(255,255,255,0.05)',
                  color: transactionType === 'withdrawal' ? 'var(--color-status-negative)' : '#888'
                }}
              >
                - Withdrawal
              </button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Amount (PHP) *</label>
                <input
                  type="text"
                  value={form.amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setForm({ ...form, amount: val });
                  }}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={transactionType === 'deposit' ? 'e.g., Juan Dela Cruz' : 'e.g., PNB, Vendor Name'}
                  list="existing-names"
                  autoComplete="off"
                />
                <datalist id="existing-names">
                  {existingNames.map((name, idx) => (
                    <option key={idx} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={transactionType === 'deposit' ? 'e.g., Cash Deposit, GCash Transfer' : 'e.g., Checkbook, Venue Deposit'}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Reference No.</label>
                <input
                  type="text"
                  value={form.reference_no}
                  onChange={(e) => setForm({ ...form, reference_no: e.target.value })}
                  placeholder="e.g., REF NO. 123456"
                />
              </div>
              <div className="form-group">
                <label>Verified</label>
                <select
                  value={form.verified}
                  onChange={(e) => setForm({ ...form, verified: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="OK">OK</option>
                </select>
              </div>
            </div>

            {/* Payment Type - Only show for deposits */}
            {transactionType === 'deposit' && (
              <div className="form-group">
                <label>Payment Type</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_type"
                      value="Full"
                      checked={form.payment_type === 'Full'}
                      onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ color: '#888' }}>Full</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_type"
                      value="Installment"
                      checked={form.payment_type === 'Installment'}
                      onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ color: '#888' }}>Installment</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="payment_type"
                      value=""
                      checked={form.payment_type === ''}
                      onChange={() => setForm({ ...form, payment_type: '' })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ color: '#888' }}>None</span>
                  </label>
                </div>
              </div>
            )}

            {result && (
              <div className={`invite-result ${result.success ? 'success' : 'error'}`}>
                <p>{result.message}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto' }}>
                {saving ? 'Saving...' : (editingId ? 'Update' : 'Add Transaction')}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Legend */}
      <div style={{ 
        marginBottom: '16px', 
        padding: '12px 16px', 
        background: 'rgba(255,255,255,0.03)', 
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#888'
      }}>
        [L] = Linked to Master List (counts toward P25k target)
      </div>

      {/* Transactions Table */}
      <div className="users-section" ref={tableRef}>
        <div className="section-header">
          <h4>Transaction History ({stats.transactionCount})</h4>
          {stats.transactionCount > 0 && canExport && (
            <button onClick={exportToCSV} className="btn-secondary">
              Export CSV
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="filter-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', minWidth: '150px' }}
          >
            <option value="all">All Types ({stats.transactionCount})</option>
            <option value="deposit">Deposits ({stats.depositCount})</option>
            <option value="withdrawal">Withdrawals ({stats.withdrawalCount})</option>
          </select>
          <input
            type="text"
            placeholder="Search by name or description..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
          />
          {(searchFilter || typeFilter !== 'all') && (
            <span style={{ color: '#888', fontSize: '0.85rem' }}>
              {totalCount} result{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {transactions.length > 0 ? (
          <>
          <ScrollableTable height="500px" stickyHeader={true}>
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="amount-col">Deposit</th>
                  <th className="amount-col">Withdrawal</th>
                  <th className="amount-col">Balance</th>
                  <th>Reference No.</th>
                  <th>Verified</th>
                  <th>Payment Type</th>
                  <th>Recorded By</th>
                  <th>Receipt</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {t.transaction_date ? new Date(t.transaction_date.split('T')[0] + 'T00:00:00').toLocaleDateString('en-PH', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '-'}
                    </td>
                    <td>
                      {t.name || '-'}
                      {t.master_list_id && (
                        <span 
                          title={t.ml_first_name ? `Linked to: ${t.ml_first_name} ${t.ml_last_name} (${t.ml_section})` : 'Linked to Master List'}
                          style={{ marginLeft: '6px', cursor: 'help', color: 'var(--color-hover)' }}
                        >
                          [L]
                        </span>
                      )}
                    </td>
                    <td>{t.description || '-'}</td>
                    <td className="amount-col deposit-cell">
                      {t.deposit ? formatCurrency(t.deposit) : ''}
                    </td>
                    <td className="amount-col withdrawal-cell">
                      {t.withdrawal ? formatCurrency(t.withdrawal) : ''}
                    </td>
                    <td className="amount-col balance-cell">
                      {formatCurrency(t.balance)}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{t.reference_no || '-'}</td>
                    <td>
                      <span className={`verified-badge ${t.verified === 'OK' ? 'verified' : 'pending'}`}>
                        {t.verified || 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#888' }}>{t.payment_type || '-'}</td>
                    <td style={{ fontSize: '0.85rem', color: '#888' }}>{t.recorded_by || '-'}</td>
                    <td>
                      {/* Receipt column with drag & drop */}
                      <div
                        className={`receipt-cell ${dragOver === t.id ? 'drag-over' : ''} ${t.receipt_url ? 'has-receipt' : ''}`}
                        onDragOver={(e) => canEdit && handleDragOver(e, t.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => canEdit && handleDrop(e, t.id)}
                      >
                        {uploadingReceipt === t.id ? (
                          <span className="receipt-uploading">...</span>
                        ) : t.receipt_url ? (
                          <button
                            className="receipt-icon has-receipt"
                            onClick={() => setViewingReceipt(t)}
                            title="View receipt"
                            style={{ color: '#4ade80' }}
                          >
                            r
                          </button>
                        ) : canEdit ? (
                          <>
                            <label className="receipt-upload-label" title="Drop image or click to upload">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files[0]) {
                                    handleReceiptUpload(t.id, e.target.files[0]);
                                  }
                                }}
                                style={{ display: 'none' }}
                              />
                              <span className="receipt-icon empty">[ + ]</span>
                            </label>
                          </>
                        ) : (
                          <span style={{ color: '#666' }}>-</span>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => handleEdit(t)} className="btn-link">
                            Edit
                          </button>
                          {t.deposit && !t.master_list_id && (
                            <button 
                              onClick={() => setLinkingTransaction(t)} 
                              className="btn-link"
                              style={{ color: 'var(--color-hover)' }}
                            >
                              Link
                            </button>
                          )}
                          {t.master_list_id && (
                            <button 
                              onClick={() => handleUnlink(t.id)} 
                              className="btn-link"
                              style={{ color: '#888' }}
                            >
                              Unlink
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(t.id)} 
                            className="btn-link" 
                            style={{ color: 'var(--color-status-negative)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-controls" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: '20px',
              padding: '16px',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                ← Prev
              </button>
              <span style={{ color: '#888' }}>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Next →
              </button>
            </div>
          )}
          </>
        ) : (
          <p className="no-data">{searchFilter || typeFilter !== 'all' ? 'No matching transactions' : 'No transactions recorded yet'}</p>
        )}
      </div>

      {/* Link to Master List Modal */}
      {linkingTransaction && (
        <div className="receipt-modal-overlay" onClick={() => { setLinkingTransaction(null); setLinkSearch(''); }}>
          <div className="receipt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="receipt-modal-header">
              <h4 className="link-modal-title">Link to Master List</h4>
              <button onClick={() => { setLinkingTransaction(null); setLinkSearch(''); }} className="receipt-modal-close">x</button>
            </div>
            <div style={{ padding: '16px' }}>
              <p className="link-modal-description">
                Link "<strong>{linkingTransaction.name}</strong>" ({formatCurrency(linkingTransaction.deposit)}) to a batchmate:
              </p>
              <input
                type="text"
                placeholder="Search by name..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="link-modal-search"
                autoFocus
              />
              <div className="link-modal-list">
                {filteredMasterListOptions.length > 0 ? (
                  filteredMasterListOptions.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleLink(linkingTransaction.id, m.id)}
                      className="link-modal-item"
                    >
                      <span className="link-modal-name">{m.first_name} {m.last_name}</span>
                      <span className="link-modal-section">({m.section})</span>
                    </div>
                  ))
                ) : (
                  <p className="link-modal-empty">
                    {linkSearch ? 'No matching batchmates' : 'Type to search...'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Viewing Modal */}
      {viewingReceipt && (
        <div className="receipt-modal-overlay" onClick={() => setViewingReceipt(null)}>
          <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-modal-header">
              <h4>Receipt - {viewingReceipt.name || viewingReceipt.description || 'Transaction'}</h4>
              <button onClick={() => setViewingReceipt(null)} className="receipt-modal-close">x</button>
            </div>
            <div className="receipt-modal-image">
              <img src={viewingReceipt.receipt_url} alt="Receipt" />
            </div>
            <div className="receipt-modal-actions">
              <a
                href={viewingReceipt.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Open Full Size
              </a>
              {canEdit && (
                <button
                  onClick={() => handleDeleteReceipt(viewingReceipt.id)}
                  className="btn-link"
                  style={{ color: 'var(--color-status-negative)' }}
                >
                  Delete Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}