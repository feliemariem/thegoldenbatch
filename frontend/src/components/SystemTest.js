import React, { useState } from 'react';
import PreviewInbox from './PreviewInbox';

/**
 * SystemTest - Super Admin testing panel
 * Only visible to uslsis.batch2003@gmail.com
 *
 * This component provides various testing features for the super admin:
 * - User Inbox Preview: See what announcements any user would see
 * - (More features can be added here in the future)
 */
export default function SystemTest({ token }) {
  const [activeFeature, setActiveFeature] = useState('inbox-preview');

  const features = [
    { id: 'inbox-preview', label: 'User Inbox Preview', description: 'Preview what any user sees in their inbox' },
    // Add more test features here as needed:
    // { id: 'feature-id', label: 'Feature Name', description: 'Feature description' },
  ];

  return (
    <div className="system-test">
      {/* Header */}
      <div style={{
        marginBottom: '24px',
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(139, 105, 20, 0.12) 0%, rgba(207, 181, 59, 0.08) 100%)',
        border: '1px solid rgba(207, 181, 59, 0.25)',
        borderRadius: '12px'
      }}>
        <h2 style={{
          color: '#CFB53B',
          margin: '0 0 8px 0',
          fontSize: '1.25rem',
          fontWeight: '700'
        }}>
          System Test
        </h2>
        <p style={{
          color: '#888',
          margin: 0,
          fontSize: '0.85rem'
        }}>
          Testing tools for system verification. Only accessible to super admin.
        </p>
      </div>

      {/* Feature Tabs (for when there are multiple features) */}
      {features.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {features.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setActiveFeature(feature.id)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                background: activeFeature === feature.id
                  ? 'rgba(207, 181, 59, 0.2)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: activeFeature === feature.id ? '#CFB53B' : '#888',
                border: activeFeature === feature.id
                  ? '1px solid rgba(207, 181, 59, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease'
              }}
              title={feature.description}
            >
              {feature.label}
            </button>
          ))}
        </div>
      )}

      {/* Feature Content */}
      {activeFeature === 'inbox-preview' && (
        <PreviewInbox token={token} />
      )}

      {/* Placeholder for future features */}
      {/*
      {activeFeature === 'another-feature' && (
        <AnotherTestFeature token={token} />
      )}
      */}
    </div>
  );
}
