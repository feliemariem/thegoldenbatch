export default function FundingProgressBar({ stats }) {
  const FULL_TARGET = 2100000;
  const CORE_TARGET = 1680000;

  const collected = parseFloat(stats.total_collected) || 0;
  const pledged = parseFloat(stats.total_pledged) || 0;
  const remaining = Math.max(FULL_TARGET - pledged, 0);
  const collectedPct = Math.min((collected / FULL_TARGET) * 100, 100);
  const pledgedPct = Math.min((pledged / FULL_TARGET) * 100, 100);
  const corePct = (CORE_TARGET / FULL_TARGET) * 100;

  const formatPeso = (n) => '₱' + Math.round(n).toLocaleString();

  return (
    <div className="status-card" style={{ width: '100%', padding: '16px 20px' }}>
      <div className="status-card-header">Funding Progress</div>

      {/* Three headline numbers */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '10px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-status-positive)' }}>
            {formatPeso(collected)}
          </div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)' }}>
            Collected
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-status-warning)' }}>
            {formatPeso(pledged)}
          </div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)' }}>
            Pledged
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: remaining > 0 ? 'var(--color-status-negative)' : 'var(--color-status-positive)' }}>
            {remaining > 0 ? formatPeso(remaining) : 'Fully Pledged'}
          </div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)' }}>
            {remaining > 0 ? 'To go' : 'Goal reached'}
          </div>
        </div>
      </div>

      {/* Layered progress bar */}
      <div style={{
        position: 'relative',
        height: '28px',
        background: 'rgba(128, 128, 128, 0.08)',
        borderRadius: '6px',
        border: '1px solid rgba(128, 128, 128, 0.15)',
        overflow: 'visible'
      }}>
        {/* Gold layer - pledged */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          height: '100%',
          width: `${pledgedPct}%`,
          background: 'linear-gradient(90deg, rgba(207,181,59,0.15), rgba(207,181,59,0.3))',
          borderRadius: '5px',
          transition: 'width 0.8s ease',
          zIndex: 1
        }} />

        {/* Green layer - collected */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          height: '100%',
          width: `${collectedPct}%`,
          background: 'linear-gradient(90deg, #1a7a42, var(--color-status-positive))',
          borderRadius: '5px',
          transition: 'width 0.8s ease',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: collectedPct > 8 ? '8px' : '0'
        }}>
          {collectedPct > 8 && (
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {collectedPct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Pledged edge marker */}
        {pledgedPct > 0 && pledgedPct < 100 && (
          <div style={{
            position: 'absolute',
            top: '-3px', bottom: '-3px',
            left: `${pledgedPct}%`,
            width: '2px',
            background: '#CFB53B',
            zIndex: 3,
            boxShadow: '0 0 6px rgba(207,181,59,0.4)'
          }}>
            <span style={{
              position: 'absolute', top: '-16px',
              transform: 'translateX(-50%)',
              fontSize: '0.55rem', fontWeight: 700,
              color: '#CFB53B',
              whiteSpace: 'nowrap'
            }}>
              {pledgedPct.toFixed(1)}%
            </span>
          </div>
        )}

        {/* Core celebration marker - dashed line at 80% */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${corePct}%`,
          width: '1px',
          borderLeft: '1px dashed var(--color-text-secondary)',
          zIndex: 4,
          opacity: 0.4
        }}>
          <span style={{
            position: 'absolute', bottom: '-15px',
            transform: 'translateX(-50%)',
            fontSize: '0.55rem', fontWeight: 600,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap'
          }}>
            ₱1.68M core
          </span>
        </div>
      </div>

      {/* Bar footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: '6px', fontSize: '0.65rem',
        color: 'var(--color-text-secondary)'
      }}>
        <span>
          <span style={{ fontWeight: 700, color: 'var(--color-status-positive)' }}>{collectedPct.toFixed(1)}%</span> collected
          {' · '}
          <span style={{ fontWeight: 700, color: 'var(--color-status-warning)' }}>{pledgedPct.toFixed(1)}%</span> pledged
        </span>
        <span>₱2,100,000 goal</span>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '10px',
        borderTop: '1px solid rgba(128, 128, 128, 0.12)',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'linear-gradient(135deg, #1a7a42, var(--color-status-positive))' }} />
          Collected — cash in hand
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(207,181,59,0.3)', border: '1px solid rgba(207,181,59,0.5)' }} />
          Pledged — committed, in installments
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.15)' }} />
          Remaining to ₱2.1M
        </div>
      </div>
    </div>
  );
}
