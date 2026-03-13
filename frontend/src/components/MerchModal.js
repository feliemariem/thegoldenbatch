import React from 'react';

export default function MerchModal({ show, merchForm, onChange, onSave, onClose, saving }) {
  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="merch-modal">
        <div className="merch-modal-header">
          <h3>Merch Preferences</h3>
          <button className="merch-modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="merch-modal-note">
          We're planning exclusive batch merch for the reunion! Save your sizes now so we have them ready when orders open.
        </p>

        <div className="merch-modal-form">
          <div className="merch-form-group">
            <label>Shirt Size</label>
            <select
              value={merchForm.shirt_size}
              onChange={(e) => onChange({ ...merchForm, shirt_size: e.target.value })}
            >
              <option value="">— Select —</option>
              <option value="XS">XS</option>
              <option value="S">Small</option>
              <option value="M">Medium</option>
              <option value="L">Large</option>
              <option value="XL">XL</option>
              <option value="2XL">2XL</option>
              <option value="3XL">3XL</option>
            </select>
          </div>

          <div className="merch-form-group">
            <label>Jacket Size</label>
            <select
              value={merchForm.jacket_size}
              onChange={(e) => onChange({ ...merchForm, jacket_size: e.target.value })}
            >
              <option value="">— Select —</option>
              <option value="XS">XS</option>
              <option value="S">Small</option>
              <option value="M">Medium</option>
              <option value="L">Large</option>
              <option value="XL">XL</option>
              <option value="2XL">2XL</option>
              <option value="3XL">3XL</option>
            </select>
          </div>

          <p className="merch-form-hint">You can always update this later.</p>

          <div className="merch-form-actions">
            <button
              className="btn-save"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
