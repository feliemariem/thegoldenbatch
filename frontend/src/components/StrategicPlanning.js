import { useState } from 'react';

const presentations = [
  {
    id: 'plan',
    label: 'Strategic Plan',
    file: '/presentations/Funding_Strategy_Visual.html'
  },
  {
    id: 'funding',
    label: 'Funding Plan',
    file: '/presentations/Strategic_Plan_2026-2028.html'
  },
  {
    id: 'website registration flow',
    label: 'Website Registration Flow',
    file: '/presentations/Website_Registration_Flow.html'
  }
];

export default function StrategicPlanning() {
  const [activePresentation, setActivePresentation] = useState('plan');

  const activeItem = presentations.find(p => p.id === activePresentation);

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
            <iframe
              src={activeItem.file}
              title={activeItem.label}
              width="100%"
              height="800"
              allow="autoplay"
              className="strategic-iframe"
            />
          )}
        </div>
      </div>
    </div>
  );
}
