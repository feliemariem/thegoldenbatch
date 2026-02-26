import { useState } from 'react';

const CORE_TARGET = 1680000;
const FULL_TARGET = 2100000;

const TIER_COLORS = {
  cornerstone: '#CFB53B',
  pillar: '#C0C0C0',
  anchor: '#CD7F32',
  root: 'var(--color-status-positive)'
};

const SCENARIOS = {
  conservative: {
    label: 'Conservative',
    cornerstone: { target: 6, avg: 25000 },
    pillar: { target: 22, avg: 20000 },
    anchor: { target: 27, avg: 12000 },
    root: { target: 15, avg: 3000 },
    fundraising: 300000,
    totalBuilders: 70,
    projectedLabel: '₱1.78M'
  },
  target: {
    label: 'Target',
    cornerstone: { target: 11, avg: 25000 },
    pillar: { target: 22, avg: 21000 },
    anchor: { target: 27, avg: 13000 },
    root: { target: 17, avg: 4000 },
    fundraising: 500000,
    totalBuilders: 77,
    projectedLabel: '₱2.17M'
  },
  realistic: {
    label: 'Realistic Mix',
    cornerstone: { target: 10, avg: 25000 },
    pillar: { target: 18, avg: 20000 },
    anchor: { target: 35, avg: 12000 },
    root: { target: 22, avg: 3000 },
    fundraising: 450000,
    totalBuilders: 85,
    projectedLabel: '₱1.99M'
  },
  strong: {
    label: 'Strong',
    cornerstone: { target: 17, avg: 27000 },
    pillar: { target: 27, avg: 21000 },
    anchor: { target: 27, avg: 14000 },
    root: { target: 17, avg: 5000 },
    fundraising: 650000,
    totalBuilders: 88,
    projectedLabel: '₱2.67M'
  }
};

export default function FundingReality({ stats }) {
  const [selectedScenario, setSelectedScenario] = useState('target');
  const [fundraisingAmount, setFundraisingAmount] = useState(500000);
  const [isExpanded, setIsExpanded] = useState(false);

  const getActual = (tier) => {
    const details = stats.tier_details?.[tier];
    return {
      count: details?.count || 0,
      avgPledge: details?.avg_pledge || 0,
      totalPledged: details?.total_pledged || 0,
      totalCollected: details?.total_collected || 0
    };
  };

  const totalBuilders = parseInt(stats.total_builders) || 0;
  const noTier = parseInt(stats.no_tier) || 0;
  const totalCollected = parseFloat(stats.total_collected) || 0;
  const totalPledged = parseFloat(stats.total_pledged) || 0;

  const formatPeso = (n) => Math.round(n).toLocaleString();

  const getProjected = (scenario, fundraising) => {
    let total = 0;
    ['cornerstone', 'pillar', 'anchor', 'root'].forEach(tier => {
      const actual = getActual(tier);
      const target = scenario[tier];
      const remaining = Math.max(target.target - actual.count, 0);
      if (tier === 'root') {
        total += actual.totalCollected + (remaining * target.avg);
      } else {
        total += actual.totalPledged + (remaining * target.avg);
      }
    });
    return total + fundraising;
  };

  const handleScenarioClick = (key) => {
    setSelectedScenario(key);
    setFundraisingAmount(SCENARIOS[key].fundraising);
  };

  const currentScenario = SCENARIOS[selectedScenario];
  const projected = getProjected(currentScenario, fundraisingAmount);
  const gap = Math.max(FULL_TARGET - projected, 0);
  const coreGap = Math.max(CORE_TARGET - projected, 0);

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Collapsed Toggle Row */}
      <div
        className="status-card"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          cursor: 'pointer',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          Funding Reality · ₱{formatPeso(totalCollected)} collected · ₱{formatPeso(totalPledged)} pledged · {totalBuilders} builders
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div
          className="status-card"
          style={{
            width: '100%',
            marginTop: '2px',
            padding: '20px',
            borderTop: '1px solid rgba(128,128,128,0.1)'
          }}
        >
          {/* Reality Strip */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { value: `₱${formatPeso(totalCollected)}`, label: 'COLLECTED', color: 'var(--color-status-positive)' },
              { value: `₱${formatPeso(totalPledged)}`, label: 'PLEDGED', color: 'var(--color-status-warning)' },
              { value: totalBuilders, label: 'BUILDERS', color: 'var(--color-text-primary)' },
              { value: noTier, label: 'NO TIER YET', color: 'var(--color-status-warning)' }
            ].map((cell, i) => (
              <div
                key={cell.label}
                style={{
                  flex: '1 1 120px',
                  minWidth: '100px',
                  padding: '10px 12px',
                  textAlign: 'center',
                  background: 'rgba(128,128,128,0.04)',
                  border: '1px solid rgba(128,128,128,0.1)',
                  borderRadius: i === 0 ? '6px 0 0 6px' : i === 3 ? '0 6px 6px 0' : '0'
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: cell.color }}>{cell.value}</div>
                <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{cell.label}</div>
              </div>
            ))}
          </div>

          {/* Scenario Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {Object.entries(SCENARIOS).map(([key, scenario]) => {
              const isActive = selectedScenario === key;
              return (
                <button
                  key={key}
                  onClick={() => handleScenarioClick(key)}
                  style={{
                    flex: '1 1 140px',
                    padding: '10px 12px',
                    border: isActive ? '1px solid rgba(207,181,59,0.35)' : '1px solid rgba(128,128,128,0.15)',
                    borderRadius: '6px',
                    background: isActive ? 'rgba(207,181,59,0.12)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isActive ? '#CFB53B' : 'var(--color-text-secondary)' }}>
                    {scenario.label}{key === 'target' ? ' ★' : ''}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {scenario.totalBuilders} builders · {scenario.projectedLabel}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tier Ranges Reference */}
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
            Cornerstone ₱25,000+ · Pillar ₱18,000–₱24,000 · Anchor ₱10,000–₱17,000 · Root Open amount
          </div>

          {/* Builder Quotas vs Reality */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Builder Quotas vs Reality
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {currentScenario.label} Scenario
              </span>
            </div>

            {['cornerstone', 'pillar', 'anchor', 'root'].map(tier => {
              const actual = getActual(tier);
              const target = currentScenario[tier].target;
              const remaining = Math.max(target - actual.count, 0);
              const surplus = actual.count > target ? actual.count - target : 0;
              const ratio = target > 0 ? actual.count / target : 0;
              const pct = Math.min(ratio * 100, 100);

              let statusIcon = '🔴';
              if (actual.count >= target) statusIcon = '✅';
              else if (ratio >= 0.5) statusIcon = '🟡';

              let barColor = 'var(--color-status-negative)';
              if (actual.count >= target) barColor = 'var(--color-status-positive)';
              else if (ratio >= 0.5) barColor = 'var(--color-status-warning)';

              const tierAmount = tier === 'root' ? actual.totalCollected : actual.totalPledged;
              const targetAmount = target * currentScenario[tier].avg;

              return (
                <div
                  key={tier}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 100px',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(128,128,128,0.08)'
                  }}
                >
                  {/* Left */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TIER_COLORS[tier] }} />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>{tier}</span>
                      <span style={{ fontSize: '0.75rem' }}>{statusIcon}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', marginTop: '2px', marginLeft: '14px' }}>
                      {tier === 'root' ? 'open amount' : actual.count > 0 ? `avg ₱${formatPeso(actual.avgPledge)}` : 'no builders yet'}
                    </div>
                  </div>

                  {/* Middle */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {actual.count} / {target}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: surplus > 0 ? 'var(--color-status-positive)' : 'var(--color-text-secondary)' }}>
                        {surplus > 0 ? `Exceeded! +${surplus}` : `${remaining} needed`}
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(128,128,128,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: actual.count === 0 ? 'rgba(128,128,128,0.15)' : barColor,
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>

                  {/* Right */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      ₱{formatPeso(tierAmount)}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>
                      / ₱{formatPeso(targetAmount)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Root note */}
            <div style={{ fontSize: '0.68rem', fontStyle: 'italic', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              Root has no fixed pledge. Amount shown is actual deposits. Projections use estimated averages.
            </div>
          </div>

          {/* Fundraising Revenue */}
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(128,128,128,0.04)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Fundraising Revenue</span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#CFB53B' }}>₱{formatPeso(fundraisingAmount)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1000000}
              step={25000}
              value={fundraisingAmount}
              onChange={(e) => setFundraisingAmount(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: '8px', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              <span>₱0</span>
              <span>₱1,000,000</span>
            </div>
          </div>

          {/* Progress Bars */}
          <div style={{ marginBottom: '16px' }}>
            {/* Core Celebration */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Core Celebration</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>₱1,680,000</span>
              </div>
              <div style={{ height: '10px', background: 'rgba(128,128,128,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((projected / CORE_TARGET) * 100, 100)}%`,
                  background: projected >= CORE_TARGET ? 'var(--color-status-positive)' : projected >= CORE_TARGET * 0.7 ? 'var(--color-status-warning)' : 'var(--color-status-negative)',
                  borderRadius: '5px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Projected: <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>₱{formatPeso(projected)}</span>
              </div>
            </div>

            {/* Full Vision */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Full Vision</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>₱2,100,000</span>
              </div>
              <div style={{ height: '10px', background: 'rgba(128,128,128,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((projected / FULL_TARGET) * 100, 100)}%`,
                  background: projected >= FULL_TARGET ? 'var(--color-status-positive)' : projected >= FULL_TARGET * 0.8 ? 'var(--color-status-warning)' : 'var(--color-status-negative)',
                  borderRadius: '5px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                Projected: <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>₱{formatPeso(projected)}</span>
                {projected >= FULL_TARGET && <span style={{ color: 'var(--color-status-positive)', marginLeft: '6px' }}>+₱{formatPeso(projected - FULL_TARGET)} surplus</span>}
              </div>
            </div>
          </div>

          {/* Gap Analysis */}
          {projected < FULL_TARGET && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(128,128,128,0.04)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>To close the gap, you need any of:</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-status-negative)' }}>₱{formatPeso(gap)} gap</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {[
                  { tier: 'Cornerstones', count: Math.ceil(gap / 25000), avg: '₱25K' },
                  { tier: 'Pillars', count: Math.ceil(gap / 20000), avg: '₱20K' },
                  { tier: 'Anchors', count: Math.ceil(gap / 12000), avg: '₱12K' }
                ].map(option => (
                  <div
                    key={option.tier}
                    style={{
                      flex: '1 1 120px',
                      padding: '8px 10px',
                      background: 'rgba(128,128,128,0.06)',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>+{option.count}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>{option.tier} at {option.avg} avg</div>
                  </div>
                ))}
              </div>

              {/* Mixed path */}
              {(() => {
                const csExtra = Math.round((gap * 0.2) / 25000);
                const piExtra = Math.round((gap * 0.3) / 20000);
                const anExtra = Math.round((gap * 0.35) / 12000);
                const frExtra = Math.round((gap * 0.15) / 1000);
                return (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    Or a mix: +{csExtra} Cornerstones + {piExtra} Pillars + {anExtra} Anchors + ₱{frExtra}K more fundraising
                  </div>
                );
              })()}
            </div>
          )}

          {/* Verdict */}
          {(() => {
            const targetBuilders = currentScenario.totalBuilders;
            const actualBuilders = totalBuilders;

            if (projected >= FULL_TARGET) {
              const surplus = projected - FULL_TARGET;
              return (
                <div style={{
                  padding: '14px',
                  background: 'rgba(74, 157, 109, 0.06)',
                  border: '1px solid rgba(74, 157, 109, 0.2)',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>✅</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-status-positive)' }}>Full Vision Achievable</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    If the {currentScenario.label} scenario holds — {targetBuilders} builders + ₱{formatPeso(fundraisingAmount)} fundraising — the batch reaches ₱{formatPeso(projected)}, exceeding the ₱2.1M goal by ₱{formatPeso(surplus)}. Currently {actualBuilders} builders locked in. Focus on converting the remaining quotas.
                  </div>
                </div>
              );
            } else if (projected >= CORE_TARGET) {
              return (
                <div style={{
                  padding: '14px',
                  background: 'rgba(201, 162, 39, 0.06)',
                  border: '1px solid rgba(201, 162, 39, 0.2)',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-status-warning)' }}>Core Protected, Full Vision Needs Work</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    The {currentScenario.label} scenario projects ₱{formatPeso(projected)} — enough to cover the ₱1.68M core celebration. Gap to full vision: ₱{formatPeso(gap)}. Currently {actualBuilders} of {targetBuilders} target builders are in. Close the tier quotas or increase fundraising.
                  </div>
                </div>
              );
            } else {
              return (
                <div style={{
                  padding: '14px',
                  background: 'rgba(181, 100, 100, 0.06)',
                  border: '1px solid rgba(181, 100, 100, 0.2)',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '1rem' }}>🚨</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-status-negative)' }}>Core Celebration at Risk</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    Even at {currentScenario.label} targets, projected ₱{formatPeso(projected)} falls ₱{formatPeso(coreGap)} short of the ₱1.68M core budget. Currently only {actualBuilders} builders committed. Immediate outreach required — especially for Cornerstone and Pillar quotas.
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}
    </div>
  );
}
