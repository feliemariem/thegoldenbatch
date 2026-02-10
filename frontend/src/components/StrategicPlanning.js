import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const presentations = [
  {
    id: 'plan',
    label: 'Strategic Plan',
    file: '/Users/feliemarie/Developer/Projects/thegoldenbatch/frontend/public/presentations/Funding_Strategy_Visual.html'
  },
  {
    id: 'funding',
    label: 'Funding Plan',
    file: '/Users/feliemarie/Developer/Projects/thegoldenbatch/frontend/public/presentations/Strategic_Plan_2026-2028.html'
  }
];

export default function StrategicPlanning() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [activePresentation, setActivePresentation] = useState('plan');

  const activeItem = presentations.find(p => p.id === activePresentation);

  return (
    <div className="strategic-planning">
      <h2 className="strategic-planning-title">Strategic Planning</h2>

      {/* Presentation Tabs */}
      <div className="strategic-planning-tabs">
        {presentations.map(presentation => (
          <button
            key={presentation.id}
            onClick={() => setActivePresentation(presentation.id)}
            className={`strategic-tab ${activePresentation === presentation.id ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              background: activePresentation === presentation.id
                ? (isDarkMode ? '#CFB53B' : '#006633')
                : 'transparent',
              color: activePresentation === presentation.id
                ? (isDarkMode ? '#1a1a2e' : '#ffffff')
                : '#999',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {presentation.label}
          </button>
        ))}
      </div>

      {/* Presentation Viewer */}
      <div className="strategic-planning-viewer">
        {activeItem && (
          <iframe
            src={activeItem.url}
            title={activeItem.label}
            width="100%"
            height="800"
            frameBorder="0"
            allowFullScreen
            style={{
              borderRadius: '12px',
              border: isDarkMode
                ? '1px solid rgba(207, 181, 59, 0.2)'
                : '1px solid rgba(0, 102, 51, 0.15)'
            }}
          />
        )}
      </div>
    </div>
  );
}
