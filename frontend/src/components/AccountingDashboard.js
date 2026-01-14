import React, { useState, useEffect, useRef } from 'react';

export default function AccountingDashboard({ token, canEdit = true, canExport = true }) {
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [totalDeposits, setTotalDeposits] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
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
    verified: 'Pending'
  });
  const [result, setResult] = useState(null);
  
  // Receipt states
  const [uploadingReceipt, setUploadingReceipt] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/ledger', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTransactions(data.transactions || []);
      setBalance(data.balance || 0);
      setTotalDeposits(data.totalDeposits || 0);
      setTotalWithdrawals(data.totalWithdrawals || 0);
    } catch (err) {
      console.error('Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      transaction_date: new Date().toISOString().split('T')[0],
      name: '',
      description: '',
      amount: '',
      reference_no: '',
      verified: 'Pending'
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
      verified: form.verified
    };

    try {
      const url = editingId 
        ? `http://localhost:5000/api/ledger/${editingId}`
        : 'http://localhost:5000/api/ledger';
      
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
        fetchTransactions();
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
      verified: transaction.verified || 'Pending'
    });
    setEditingId(transaction.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;

    try {
      const res = await fetch(`http://localhost:5000/api/ledger/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error('Failed to delete');
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
      const res = await fetch(`http://localhost:5000/api/ledger/${transactionId}/receipt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchTransactions();
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
      const res = await fetch(`http://localhost:5000/api/ledger/${transactionId}/receipt`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchTransactions();
        setViewingReceipt(null);
      }
    } catch (err) {
      console.error('Failed to delete receipt');
    }
  };

  const handleDragOver = (e, transactionId) => {
    e.preventDefault();
    setDragOver(transactionId);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(null);
  };

  const handleDrop = (e, transactionId) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleReceiptUpload(transactionId, file);
    }
  };

  const exportToCSV = () => {
    if (!transactions.length) return;

    const headers = ['Date', 'Name', 'Description', 'Deposit', 'Withdrawal', 'Balance', 'Reference No.', 'Verified', 'Recorded By', 'Receipt'];
    const rows = transactions.map(t => [
      t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : '',
      t.name || '',
      t.description || '',
      t.deposit || '',
      t.withdrawal || '',
      t.balance?.toFixed(2) || '',
      t.reference_no || '',
      t.verified || '',
      t.recorded_by || '',
      t.receipt_url || ''
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usls-batch-2003-ledger.csv';
    a.click();
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '';
    return '₱' + parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading) {
    return <p className="perm-muted">Loading transactions...</p>;
  }

  return (
    <div>
      <h3>Accounting Ledger</h3>
      <p className="perm-muted" style={{ marginBottom: '24px' }}>Track all deposits and withdrawals for the reunion fund.</p>

      {/* Summary Cards */}
      <div className="ledger-summary">
        <div className="ledger-summary-card deposits">
          <span className="ledger-summary-label">Total Deposits</span>
          <span className="ledger-summary-amount deposit">{formatCurrency(totalDeposits)}</span>
        </div>
        <div className="ledger-summary-card withdrawals">
          <span className="ledger-summary-label">Total Withdrawals</span>
          <span className="ledger-summary-amount withdrawal">{formatCurrency(totalWithdrawals)}</span>
        </div>
        <div className="ledger-summary-card balance">
          <span className="ledger-summary-label">Current Balance</span>
          <span className="ledger-summary-amount">{formatCurrency(balance)}</span>
        </div>
      </div>

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
        <div className="invite-section" style={{ marginBottom: '24px' }}>
          <h4 style={{ marginBottom: '16px' }}>{editingId ? 'Edit Transaction' : 'Add New Transaction'}</h4>
          
          {/* Transaction Type Toggle */}
          <div className="ledger-type-toggle">
            <button
              type="button"
              className={`ledger-type-btn ${transactionType === 'deposit' ? 'active deposit' : ''}`}
              onClick={() => setTransactionType('deposit')}
            >
              Deposit (Money In)
            </button>
            <button
              type="button"
              className={`ledger-type-btn ${transactionType === 'withdrawal' ? 'active withdrawal' : ''}`}
              onClick={() => setTransactionType('withdrawal')}
            >
              Withdrawal (Money Out)
            </button>
          </div>

          <form onSubmit={handleSubmit}>
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
                <label>Amount (₱) *</label>
                <input
                  type="text"
                  value={form.amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setForm({ ...form, amount: val });
                  }}
                  placeholder="0.00"
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
                />
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

      {/* Transactions Table */}
      <div className="users-section">
        <div className="section-header">
          <h4>Transaction History ({transactions.length})</h4>
          {transactions.length > 0 && canExport && (
            <button onClick={exportToCSV} className="btn-secondary">
              Export CSV
            </button>
          )}
        </div>

        {transactions.length > 0 ? (
          <div className="table-wrapper">
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
                  <th>Recorded By</th>
                  <th>Receipt</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-PH', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '-'}
                    </td>
                    <td>{t.name || '-'}</td>
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
                          <span className="receipt-uploading">⏳</span>
                        ) : t.receipt_url ? (
                          <button
                            className="receipt-icon has-receipt"
                            onClick={() => setViewingReceipt(t)}
                            title="View receipt"
                          >
                            🧾
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
                              <span className="receipt-icon empty">＋</span>
                            </label>
                          </>
                        ) : (
                          <span style={{ color: '#666' }}>-</span>
                        )}
                      </div>
                    </td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleEdit(t)} className="btn-link">
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(t.id)} 
                            className="btn-link" 
                            style={{ color: '#dc3545' }}
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
          </div>
        ) : (
          <p className="no-data">No transactions recorded yet</p>
        )}
      </div>

      {/* Receipt Lightbox Modal */}
      {viewingReceipt && (
        <div className="receipt-modal-overlay" onClick={() => setViewingReceipt(null)}>
          <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="receipt-modal-close" onClick={() => setViewingReceipt(null)}>
              ✕
            </button>
            <div className="receipt-modal-header">
              <h3>Receipt</h3>
              <p>
                {viewingReceipt.name || 'Unknown'} - {formatCurrency(viewingReceipt.deposit || viewingReceipt.withdrawal)}
                <br />
                <span style={{ fontSize: '0.85rem', color: '#888' }}>
                  {viewingReceipt.transaction_date ? new Date(viewingReceipt.transaction_date).toLocaleDateString() : ''}
                </span>
              </p>
            </div>
            <div className="receipt-modal-image">
              <img src={viewingReceipt.receipt_url} alt="Receipt" />
            </div>
            {canEdit && (
              <div className="receipt-modal-actions">
                <a 
                  href={viewingReceipt.receipt_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  Open Full Size
                </a>
                <button 
                  onClick={() => handleDeleteReceipt(viewingReceipt.id)}
                  className="btn-secondary"
                  style={{ color: '#dc3545', borderColor: '#dc3545' }}
                >
                  Delete Receipt
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}