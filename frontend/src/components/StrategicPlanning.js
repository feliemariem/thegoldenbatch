import { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const presentations = [
  {
    id: 'plan',
    label: 'Strategic Plan',
    file: '/presentations/Funding_Strategy_Visual.html',
    pdf: '/presentations/pdfs/Funding_Strategy_Visual.pdf'
  },
  {
    id: 'funding',
    label: 'Funding Plan',
    file: '/presentations/Strategic_Plan_2026-2028.html',
    pdf: '/presentations/pdfs/Strategic_Plan_2026-2028.pdf'
  },
  {
    id: 'website registration flow',
    label: 'Website Registration Flow',
    file: '/presentations/Website_Registration_Flow.html',
    pdf: '/presentations/pdfs/Website_Registration_Flow.pdf'
  },
  {
    id: 'budget',
    label: 'Budget Comparison (₱1.5M vs ₱1.7M)',
    file: '/presentations/Budget_Comparison.html',
    pdf: '/presentations/pdfs/Budget_Comparison.pdf'
  }
];

export default function StrategicPlanning() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [activePresentation, setActivePresentation] = useState('plan');
  const iframeRef = useRef(null);

  const activeItem = presentations.find(p => p.id === activePresentation);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownloadPdf = () => {
    if (activeItem?.pdf) {
      window.open(activeItem.pdf, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    if (activeItem?.file) {
      window.open(activeItem.file, '_blank');
    }
  };

  const buttonStyle = {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '0.85rem',
    background: isDarkMode ? '#CFB53B' : '#006633',
    color: isDarkMode ? '#1a1a2e' : '#ffffff',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  return (
    <div className="strategic-planning">
      <h2 className="strategic-planning-title">Strategic Planning</h2>

      <div className="strategic-planning-layout">
        {/* Sidebar */}
        <div className="strategic-sidebar">
          <div className="strategic-sidebar-list">
            {presentations.map(presentation => (
              <button
                key={presentation.id}
                onClick={() => setActivePresentation(presentation.id)}
                className={`strategic-sidebar-item ${activePresentation === presentation.id ? 'active' : ''}`}
              >
                {presentation.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="strategic-content">
          {activeItem && (
            <>
              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginBottom: '12px'
              }}>
                {activeItem.pdf && (
                  <button
                    onClick={handleDownloadPdf}
                    style={buttonStyle}
                    title="Download PDF"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download PDF
                  </button>
                )}
                <button
                  onClick={handleOpenNewTab}
                  style={buttonStyle}
                  title="Open in new tab"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open in New Tab
                </button>
                <button
                  onClick={handlePrint}
                  style={buttonStyle}
                  title="Print"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print
                </button>
              </div>

              {/* Iframe */}
              <iframe
                ref={iframeRef}
                src={activeItem.file}
                title={activeItem.label}
                width="100%"
                height="800"
                allow="autoplay"
                className="strategic-iframe"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}