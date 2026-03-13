import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiGet, apiUpload, apiDelete } from '../api';
import { formatPeso, getMilestoneMessage } from '../utils/profileUtils';
import ContributionPlan from './ContributionPlan';

export default function BuilderCard({ profile, onProfileUpdate, user }) {
  const location = useLocation();
  const [receipts, setReceipts] = useState([]);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptModalImage, setReceiptModalImage] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showFullPaidDetails, setShowFullPaidDetails] = useState(false);
  const [showContributionPlan, setShowContributionPlan] = useState(false);
  const [scrollToTiers, setScrollToTiers] = useState(false);
  const [message, setMessage] = useState('');
  const receiptFileInputRef = useRef(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

  // Check for openPlan URL parameter to auto-open ContributionPlan modal
  useEffect(() => {
    if (profile && profile.is_graduate) {
      const params = new URLSearchParams(location.search);
      if (params.get('openPlan') === 'true') {
        setShowContributionPlan(true);
        // Clear the param from URL to prevent re-opening on refresh
        window.history.replaceState({}, document.title, location.pathname);
      }
    }
  }, [profile, location.search, location.pathname]);

  const fetchReceipts = async () => {
    try {
      const res = await apiGet('/api/receipts/my');
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts || []);
      }
    } catch (err) {
      console.error('Failed to fetch receipts');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file) => {
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be less than 5MB');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptPreview({ file, previewUrl: e.target.result });
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const confirmUpload = async () => {
    if (!receiptPreview) return;

    setReceiptUploading(true);
    const formData = new FormData();
    formData.append('receipt', receiptPreview.file);

    try {
      const res = await apiUpload('/api/receipts', formData);

      if (res.ok) {
        fetchReceipts();
        setMessage('Receipt uploaded! We will verify it within 48 hours.');
        setTimeout(() => setMessage(''), 4000);
      } else {
        setMessage('Failed to upload receipt');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to upload receipt');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setReceiptUploading(false);
      setReceiptPreview(null);
      if (receiptFileInputRef.current) {
        receiptFileInputRef.current.value = '';
      }
    }
  };

  const cancelUpload = () => {
    setReceiptPreview(null);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = '';
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/receipts/${receiptId}`);
      if (res.ok) {
        fetchReceipts();
        setMessage('Receipt deleted');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to delete receipt');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to delete receipt');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  // Empty state - no builder tier yet
  if (!profile.builder_tier) {
    return (
      <>
        <div className="profile-card builder-card">
          <div className="card-header">
            <h3>My Contribution</h3>
          </div>
          <p className="builder-intro-text">
            <span className="builder-intro-name">{profile.first_name}</span>, this is our 25-year milestone. It belongs to all of us. Every contribution, big or small, helps us build something worthy of where we started and how far we've come.
          </p>
          <button className="btn-view-plan" onClick={() => { setShowContributionPlan(true); setScrollToTiers(false); }}>
            View Contribution Plan
          </button>
        </div>

        {showContributionPlan && (
          <ContributionPlan
            isOpen={showContributionPlan}
            onClose={() => { setShowContributionPlan(false); setScrollToTiers(false); }}
            scrollToTiers={scrollToTiers}
            onTierSaved={(tier, pledge) => {
              onProfileUpdate({
                builder_tier: tier,
                pledge_amount: pledge,
                builder_tier_set_at: new Date().toISOString()
              });
              setShowContributionPlan(false);
            }}
            currentTier={profile.builder_tier}
            currentPledge={profile.pledge_amount}
            user={user}
          />
        )}
      </>
    );
  }

  // Has builder tier
  const isFullyPaid = profile.builder_tier !== 'root' &&
    profile.pledge_amount &&
    parseFloat(profile.total_paid || 0) >= parseFloat(profile.pledge_amount);

  // Content for receipt upload, payment methods, and receipt history
  const detailsContent = (
    <>
      {/* Receipt Upload - Drag & Drop Zone */}
      {/* Show upload zone for root tier OR when not fully paid */}
      {(profile.builder_tier === 'root' ||
        !profile.pledge_amount ||
        (profile.total_paid || 0) < profile.pledge_amount) && (
        <>
          <input
            type="file"
            accept="image/*"
            onChange={handleReceiptFileChange}
            ref={receiptFileInputRef}
            style={{ display: 'none' }}
            id="receipt-upload"
          />
          {!receiptPreview ? (
            <div
              className={`receipt-dropzone ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => receiptFileInputRef.current?.click()}
            >
              <div className="dropzone-icon">📤</div>
              <div className="dropzone-text">
                <span className="dropzone-primary">Drop receipt image here</span>
                <span className="dropzone-secondary">or click to browse</span>
              </div>
            </div>
          ) : (
            <div className="receipt-preview-zone">
              <img src={receiptPreview.previewUrl} alt="Preview" className="preview-image" />
              <div className="preview-actions">
                <button
                  className="btn-preview-confirm"
                  onClick={confirmUpload}
                  disabled={receiptUploading}
                >
                  {receiptUploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  className="btn-preview-cancel"
                  onClick={cancelUpload}
                  disabled={receiptUploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment Methods Toggle */}
      <div className="payment-methods-toggle">
        <button
          className={`toggle-btn ${paymentMethodsOpen ? 'open' : ''}`}
          onClick={() => setPaymentMethodsOpen(!paymentMethodsOpen)}
        >
          Payment Methods <span className="toggle-arrow">{paymentMethodsOpen ? '▲' : '▼'}</span>
        </button>
        {paymentMethodsOpen && (
          <div className="payment-methods-content">
            <div className="payment-method-item">
              <div className="method-label">Bank Deposit</div>
              <div className="method-detail"><span>Bank:</span> Philippine National Bank (PNB)</div>
              <div className="method-detail"><span>Account Names:</span> Narciso Javelosa III or Mary Rose Frances Uy</div>
              <div className="method-detail"><span>Account Number:</span> 307770014898</div>
            </div>
            <div className="payment-method-item">
              <div className="method-label">International Transfers (Swift)</div>
              <div className="method-detail"><span>Bank:</span> PNB Bacolod Lacson Branch</div>
              <div className="method-detail"><span>Address:</span> 10th Lacson Street, Bacolod City, Negros Occidental 6100</div>
              <div className="method-detail"><span>Tel:</span> (63) (034) 432-0605 / 434-8007</div>
              <div className="method-detail"><span>SWIFT Code:</span> PNBMPHMM</div>
              <div className="method-detail"><span>Routing No.:</span> 040080019</div>
              <div className="method-detail"><span>Email:</span> bacolod_lacson@pnb.com.ph</div>
              <div className="method-detail"><span>Website:</span> pnb.com.ph</div>
            </div>
          </div>
        )}
      </div>

      {/* Receipt History */}
      {receipts.length > 0 && (
        <div className="builder-receipt-list">
          <h4>Receipt History</h4>
          <div className="receipt-list-scroll">
            {receipts.map(receipt => (
              <div key={receipt.id} className="receipt-row">
                <button
                  className="receipt-thumb"
                  onClick={() => setReceiptModalImage(receipt.image_url)}
                  type="button"
                >
                  <img src={receipt.image_url} alt="Receipt" />
                </button>
                <div className="receipt-info">
                  <span className="receipt-date">
                    {new Date(receipt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className={`receipt-source-badge ${receipt.source}`}>
                    {receipt.source === 'user' ? 'You' : 'Committee'}
                  </span>
                </div>
                <span className={`receipt-status-badge ${receipt.status}`}>
                  {receipt.status === 'submitted'
                    ? 'Submitted'
                    : receipt.status === 'verified'
                      ? 'Verified'
                      : 'Pending Verification'}
                </span>
                {receipt.ledger_id && (
                  <span className={`receipt-verified-badge ${receipt.ledger_status === 'OK' ? 'verified' : 'pending'}`}>
                    {receipt.ledger_status === 'OK' ? '✓ Verified' : 'Pending'}
                    {receipt.ledger_amount && ` · ₱${parseFloat(receipt.ledger_amount).toLocaleString()}`}
                  </span>
                )}
                {receipt.status === 'submitted' && receipt.source === 'user' && (
                  deleteConfirmId === receipt.id ? (
                    <div className="receipt-delete-confirm">
                      <span>Delete this receipt? You can upload a new one after.</span>
                      <button
                        className="btn-delete-yes"
                        onClick={() => handleDeleteReceipt(receipt.id)}
                        disabled={deleting}
                      >
                        Delete
                      </button>
                      <button
                        className="btn-delete-no"
                        onClick={() => setDeleteConfirmId(null)}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-delete-receipt"
                      onClick={() => setDeleteConfirmId(receipt.id)}
                      title="Delete this receipt"
                    >
                      ✕
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
          {receipts.some(r => r.status === 'submitted') && (
            <p className="receipt-pending-note">
              Your receipt has been submitted. The committee will verify and credit your account within 48 hours.
            </p>
          )}
        </div>
      )}
      {receipts.length === 0 && !isFullyPaid && (
        <p className="no-receipts-text">No receipts yet. Upload a receipt after making a payment.</p>
      )}
    </>
  );

  return (
    <>
      <div className="profile-card builder-card has-tier">
        <div className="card-header">
          <h3>My Contribution</h3>
        </div>
        {message && (
          <div className="profile-message success" style={{ marginBottom: '12px' }}>
            {message}
          </div>
        )}
        <div className={`builder-tier-badge ${profile.builder_tier}`}>
          {profile.builder_tier.charAt(0).toUpperCase() + profile.builder_tier.slice(1)}
          {profile.builder_tier !== 'root' && profile.pledge_amount && (
            <span className="badge-amount">· {formatPeso(profile.pledge_amount)}</span>
          )}
        </div>

        {profile.builder_tier !== 'root' && profile.pledge_amount ? (
          <>
            <div className="builder-progress">
              <div className="builder-progress-bar">
                <div
                  className="builder-progress-fill"
                  style={{ width: `${Math.min(((profile.total_paid || 0) / profile.pledge_amount) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="builder-progress-text">
                <span className="builder-paid">{formatPeso(profile.total_paid || 0)}</span>
                <span className="builder-total">/ {formatPeso(profile.pledge_amount)}</span>
                <span className="builder-pct">({Math.min(Math.round(((profile.total_paid || 0) / profile.pledge_amount) * 100), 100)}%)</span>
              </div>
              {(profile.pending_paid || 0) > 0 && (
                <div className="builder-pending">
                  +{formatPeso(profile.pending_paid)} pending verification
                </div>
              )}
              {(profile.total_paid || 0) < (profile.pledge_amount || 0) && (
                <div className="builder-remaining">
                  Remaining: <strong>{formatPeso((profile.pledge_amount || 0) - (profile.total_paid || 0))}</strong>
                </div>
              )}
              <div className="builder-milestone-message">
                {getMilestoneMessage(Math.round(((profile.total_paid || 0) / profile.pledge_amount) * 100))}
              </div>
            </div>
          </>
        ) : (
          <div className="builder-root-status">
            <span className="root-message">{formatPeso(profile.total_paid || 0)} contributed. Every peso counts — thank you!</span>
            {(profile.pending_paid || 0) > 0 && (
              <div className="builder-pending" style={{ marginTop: '8px' }}>
                +{formatPeso(profile.pending_paid)} pending verification
              </div>
            )}
          </div>
        )}

        {/* Check if fully paid (non-root tier) */}
        {isFullyPaid ? (
          <>
            {/* Toggle link for fully paid users */}
            <button
              className="btn-show-details"
              onClick={() => setShowFullPaidDetails(!showFullPaidDetails)}
            >
              {showFullPaidDetails ? 'Hide Details' : 'Show Details'} <span className="toggle-arrow">{showFullPaidDetails ? '▲' : '▼'}</span>
            </button>

            {/* Collapsible details section */}
            {showFullPaidDetails && (
              <div className="full-paid-details">
                {detailsContent}
              </div>
            )}
          </>
        ) : (
          // Show everything expanded when not fully paid
          detailsContent
        )}

        <div className="builder-links">
          <button className="btn-link-text" onClick={() => { setShowContributionPlan(true); setScrollToTiers(true); }}>Change Tier</button>
          <span className="link-separator">·</span>
          <button className="btn-link-text" onClick={() => { setShowContributionPlan(true); setScrollToTiers(false); }}>View Full Plan</button>
        </div>
      </div>

      {showContributionPlan && (
        <ContributionPlan
          isOpen={showContributionPlan}
          onClose={() => { setShowContributionPlan(false); setScrollToTiers(false); }}
          scrollToTiers={scrollToTiers}
          onTierSaved={(tier, pledge) => {
            onProfileUpdate({
              builder_tier: tier,
              pledge_amount: pledge,
              builder_tier_set_at: new Date().toISOString()
            });
            setShowContributionPlan(false);
          }}
          currentTier={profile.builder_tier}
          currentPledge={profile.pledge_amount}
          user={user}
        />
      )}

      {/* Receipt Image Modal */}
      {receiptModalImage && (
        <div className="receipt-modal-overlay" onClick={() => setReceiptModalImage(null)}>
          <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="receipt-modal-close" onClick={() => setReceiptModalImage(null)}>✕</button>
            <img src={receiptModalImage} alt="Receipt" />
          </div>
        </div>
      )}
    </>
  );
}
