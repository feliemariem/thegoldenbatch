/**
 * Summary Emails - Weekly and Monthly automated reports
 * Sends to uslsis.batch2003@gmail.com
 *
 * Weekly: Every Monday 8:00 AM PHT (March 9, 2026 - Dec 31, 2028)
 * Monthly: 1st of every month 8:00 AM PHT (April 1, 2026 - Jan 1, 2029)
 */

const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const db = require('../db');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const RECIPIENT_EMAIL = 'uslsis.batch2003@gmail.com';
const DASHBOARD_URL = 'https://thegoldenbatch2003.com/admin';
const FUNDING_TARGET = 2100000;
const API_URL = process.env.API_URL || 'https://api.thegoldenbatch2003.com';

// Monthly targets by year
const MONTHLY_TARGETS = {
  2026: 50000,
  2027: 55000,
  2028: 65000
};

// ============================================================
// SNAPSHOT TABLE MANAGEMENT
// ============================================================

/**
 * Creates the snapshot table if it doesn't exist
 */
const ensureSnapshotTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS summary_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE NOT NULL,
        snapshot_type VARCHAR(10) NOT NULL, -- 'weekly' or 'monthly'
        registered_count INTEGER DEFAULT 0,
        invited_count INTEGER DEFAULT 0,
        total_raised DECIMAL(12,2) DEFAULT 0,
        cornerstone_count INTEGER DEFAULT 0,
        pillar_count INTEGER DEFAULT 0,
        anchor_count INTEGER DEFAULT 0,
        root_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_summary_snapshots_date
      ON summary_snapshots(snapshot_date DESC)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_summary_snapshots_type
      ON summary_snapshots(snapshot_type)
    `);
  } catch (err) {
    console.error('[SUMMARY] Error ensuring snapshot table:', err.message);
  }
};

/**
 * Saves current metrics as a snapshot
 */
const saveSnapshot = async (type) => {
  try {
    const metrics = await getCurrentMetrics();
    await db.query(`
      INSERT INTO summary_snapshots
        (snapshot_date, snapshot_type, registered_count, invited_count, total_raised,
         cornerstone_count, pillar_count, anchor_count, root_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      new Date(),
      type,
      metrics.registeredCount,
      metrics.invitedCount,
      metrics.totalRaised,
      metrics.tierCounts.cornerstone,
      metrics.tierCounts.pillar,
      metrics.tierCounts.anchor,
      metrics.tierCounts.root
    ]);
  } catch (err) {
    console.error('[SUMMARY] Error saving snapshot:', err.message);
  }
};

/**
 * Gets the previous snapshot for comparison
 */
const getPreviousSnapshot = async (type) => {
  try {
    const result = await db.query(`
      SELECT * FROM summary_snapshots
      WHERE snapshot_type = $1
      ORDER BY snapshot_date DESC
      LIMIT 1 OFFSET 1
    `, [type]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('[SUMMARY] Error getting previous snapshot:', err.message);
    return null;
  }
};

// ============================================================
// DATA QUERIES
// ============================================================

/**
 * Gets current metrics for the summary
 */
const getCurrentMetrics = async () => {
  // Registered count (users with accounts)
  const registeredResult = await db.query(`
    SELECT COUNT(*) as count FROM users
  `);
  const registeredCount = parseInt(registeredResult.rows[0].count) || 0;

  // Invited count (invites sent)
  const invitedResult = await db.query(`
    SELECT COUNT(*) as count FROM invites WHERE email_sent = true
  `);
  const invitedCount = parseInt(invitedResult.rows[0].count) || 0;

  // Total raised (verified deposits only)
  const fundsResult = await db.query(`
    SELECT COALESCE(SUM(deposit), 0) as total
    FROM ledger
    WHERE verified = 'OK' AND deposit > 0
  `);
  const totalRaised = parseFloat(fundsResult.rows[0].total) || 0;

  // Builder tier counts
  const tierResult = await db.query(`
    SELECT
      builder_tier,
      COUNT(*) as count
    FROM master_list
    WHERE builder_tier IS NOT NULL
    GROUP BY builder_tier
  `);

  const tierCounts = {
    cornerstone: 0,
    pillar: 0,
    anchor: 0,
    root: 0
  };

  tierResult.rows.forEach(row => {
    if (tierCounts.hasOwnProperty(row.builder_tier)) {
      tierCounts[row.builder_tier] = parseInt(row.count) || 0;
    }
  });

  return {
    registeredCount,
    invitedCount,
    pendingCount: invitedCount - registeredCount,
    totalRaised,
    tierCounts
  };
};

/**
 * Gets new registrations within a date range
 */
const getNewRegistrations = async (startDate, endDate) => {
  const result = await db.query(`
    SELECT
      u.first_name,
      u.last_name,
      u.city,
      u.country,
      u.created_at
    FROM users u
    WHERE u.created_at >= $1 AND u.created_at < $2
    ORDER BY u.created_at DESC
  `, [startDate, endDate]);
  return result.rows;
};

/**
 * Gets funds collected within a date range
 */
const getFundsInPeriod = async (startDate, endDate) => {
  const result = await db.query(`
    SELECT COALESCE(SUM(deposit), 0) as total
    FROM ledger
    WHERE verified = 'OK'
      AND deposit > 0
      AND created_at >= $1
      AND created_at < $2
  `, [startDate, endDate]);
  return parseFloat(result.rows[0].total) || 0;
};

/**
 * Gets new invites sent within a date range
 */
const getNewInvites = async (startDate, endDate) => {
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM invites
    WHERE email_sent = true
      AND created_at >= $1
      AND created_at < $2
  `, [startDate, endDate]);
  return parseInt(result.rows[0].count) || 0;
};

/**
 * Gets new builders within a date range
 */
const getNewBuilders = async (startDate, endDate) => {
  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM master_list
    WHERE builder_tier IS NOT NULL
      AND builder_tier_set_at >= $1
      AND builder_tier_set_at < $2
  `, [startDate, endDate]);
  return parseInt(result.rows[0].count) || 0;
};

// ============================================================
// EMAIL TEMPLATE HELPERS
// ============================================================

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  if (format === 'short') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (format === 'monthYear') {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  if (format === 'month') {
    return d.toLocaleDateString('en-US', { month: 'long' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getWeekDateRange = (date) => {
  const end = new Date(date);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return {
    start,
    end,
    display: `${formatDate(start)} – ${formatDate(end)}, ${end.getFullYear()}`
  };
};

const getMonthDateRange = (date) => {
  const d = new Date(date);
  // Start of previous month
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  // End of previous month (start of current month)
  const end = new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    start,
    end,
    monthName: formatDate(start, 'month'),
    monthYear: formatDate(start, 'monthYear')
  };
};

const getPreviousMonthRange = (date) => {
  const d = new Date(date);
  // Two months ago
  const start = new Date(d.getFullYear(), d.getMonth() - 2, 1);
  const end = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { start, end };
};

const getMonthsToGo = () => {
  const now = new Date();
  const target = new Date(2028, 11, 1); // December 2028
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(0, months);
};

const getDeltaPill = (current, previous, isNegativeGood = false) => {
  const delta = current - previous;
  let bgColor = '#e0e0e0'; // gray
  let textColor = '#666666';

  if (delta > 0) {
    bgColor = isNegativeGood ? '#ffebee' : '#e8f5e9';
    textColor = isNegativeGood ? '#c62828' : '#2e7d32';
  } else if (delta < 0) {
    bgColor = isNegativeGood ? '#e8f5e9' : '#ffebee';
    textColor = isNegativeGood ? '#2e7d32' : '#c62828';
  }

  const sign = delta > 0 ? '+' : '';
  return `<span style="background:${bgColor}; color:${textColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${sign}${delta}</span>`;
};

const getDeltaText = (current, previous, prefix = '+', showPercent = false) => {
  const delta = current - previous;
  if (delta === 0) return `<span style="color:#666666;">—</span>`;

  const sign = delta > 0 ? '+' : '';
  const color = delta > 0 ? '#2e7d32' : '#c62828';

  if (showPercent && previous > 0) {
    const percent = Math.round((delta / previous) * 100);
    return `<span style="color:${color}; font-weight:600;">${sign}${percent}%</span>`;
  }

  return `<span style="color:${color}; font-weight:600;">${sign}${formatCurrency(delta)}</span>`;
};

// ============================================================
// EMAIL TEMPLATES
// ============================================================

const getEmailHeader = () => `
  <div style="background:#0a2e1a; padding:28px; text-align:center;">
    <img src="${API_URL}/images/logo.png" alt="The Golden Batch Logo" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin-bottom:12px;" />
    <div style="color:#CFB53B; letter-spacing:3px; font-weight:700; font-size:24px; font-family:Georgia,'Times New Roman',serif; margin-bottom:8px; text-transform:uppercase;">
      THE GOLDEN BATCH 2003
    </div>
    <div style="color:#ffffff; font-size:14px; font-family:Georgia,'Times New Roman',serif; letter-spacing:2px; margin-bottom:6px; text-transform:uppercase;">
      UNIVERSITY OF ST. LA SALLE - IS
    </div>
    <div style="color:#CFB53B; font-size:13px; font-family:Arial,sans-serif;">
      25th Alumni Homecoming
    </div>
  </div>
`;

const getEmailFooter = (type) => `
  <div style="background:#0a2e1a; padding:24px; text-align:center; font-family:Arial,sans-serif;">
    <div style="color:#CFB53B; font-size:14px; margin-bottom:8px;">© USLS-IS Golden Batch 2003</div>
    <div style="color:#cccccc; font-size:13px; margin-bottom:12px;">
      Questions? Email us at
      <a href="mailto:uslsis.batch2003@gmail.com" style="color:#CFB53B; text-decoration:none;">uslsis.batch2003@gmail.com</a>
    </div>
    <div style="color:#888888; font-size:11px;">
      ${type === 'weekly'
        ? 'Automated weekly summary · Every Monday 8:00 AM PHT'
        : 'Automated monthly summary · 1st of every month · 8:00 AM PHT'}
    </div>
  </div>
`;

const getGoldDivider = () => `
  <div style="height:2px; background:linear-gradient(to right, transparent, #CFB53B, transparent); margin:28px 0;"></div>
`;

const getDashboardButton = () => `
  <div style="text-align:center; margin:24px 0;">
    <a href="${DASHBOARD_URL}" style="background:#006633; color:#ffffff; padding:14px 32px; font-size:16px; font-weight:700; text-decoration:none; border-radius:8px; display:inline-block; font-family:Arial,sans-serif;">
      Go to Dashboard →
    </a>
  </div>
`;

const getMomentumBadge = (type, metrics, prevSnapshot, periodFunds) => {
  let icon, message, bgColor, borderColor;

  if (type === 'weekly') {
    const newRegs = prevSnapshot ? metrics.registeredCount - prevSnapshot.registered_count : metrics.registeredCount;
    const newFunds = periodFunds;

    if (newRegs > 0 && newFunds > 0) {
      icon = '📈';
      message = 'Growing — registrations and funds both up from last week.';
      bgColor = '#e8f5e9';
      borderColor = '#4caf50';
    } else if (newRegs > 0 || newFunds > 0) {
      icon = '➡️';
      message = 'Steady — some movement this week.';
      bgColor = '#fff8e1';
      borderColor = '#ffc107';
    } else {
      icon = '📉';
      message = 'Stalling — no new registrations or contributions this week.';
      bgColor = '#ffebee';
      borderColor = '#f44336';
    }
  } else {
    // Monthly
    const monthlyTarget = MONTHLY_TARGETS[new Date().getFullYear()] || 55000;
    const newRegs = prevSnapshot ? metrics.registeredCount - prevSnapshot.registered_count : metrics.registeredCount;
    const metTarget = periodFunds >= monthlyTarget;

    if (newRegs > 0 && metTarget) {
      icon = '📈';
      message = `Strong month — registrations up and funds exceeded monthly target.`;
      bgColor = '#e8f5e9';
      borderColor = '#4caf50';
    } else if (newRegs > 0 || periodFunds > 0) {
      icon = '➡️';
      message = 'Steady month — some progress, room to push.';
      bgColor = '#fff8e1';
      borderColor = '#ffc107';
    } else {
      icon = '📉';
      message = 'Slow month — needs attention from the committee.';
      bgColor = '#ffebee';
      borderColor = '#f44336';
    }
  }

  return `
    <div style="background:${bgColor}; border-left:4px solid ${borderColor}; padding:16px 20px; margin:20px 0; border-radius:0 8px 8px 0; font-family:Arial,sans-serif;">
      <span style="font-size:18px;">${icon}</span>
      <span style="margin-left:8px; font-size:15px; color:#333333;">${message}</span>
    </div>
  `;
};

const getRegistrationSection = (metrics, prevSnapshot) => {
  const prevReg = prevSnapshot?.registered_count || 0;
  const prevInv = prevSnapshot?.invited_count || 0;
  const prevPending = prevInv - prevReg;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif; margin:20px 0;">
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
          <span style="font-size:15px; color:#333333;">Registered</span>
        </td>
        <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right;">
          <span style="font-size:20px; font-weight:700; color:#006633; margin-right:12px;">${metrics.registeredCount}</span>
          ${getDeltaPill(metrics.registeredCount, prevReg)}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0; border-bottom:1px solid #eeeeee;">
          <span style="font-size:15px; color:#333333;">Invited</span>
        </td>
        <td style="padding:12px 0; border-bottom:1px solid #eeeeee; text-align:right;">
          <span style="font-size:20px; font-weight:700; color:#333333; margin-right:12px;">${metrics.invitedCount}</span>
          ${getDeltaPill(metrics.invitedCount, prevInv)}
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <span style="font-size:15px; color:#333333;">Pending</span>
        </td>
        <td style="padding:12px 0; text-align:right;">
          <span style="font-size:20px; font-weight:700; color:#ff9800; margin-right:12px;">${metrics.pendingCount}</span>
          ${getDeltaPill(metrics.pendingCount, prevPending, true)}
        </td>
      </tr>
    </table>
  `;
};

const getNewRegistrationsList = (registrations, periodLabel) => {
  if (!registrations || registrations.length === 0) {
    return `
      <div style="text-align:center; padding:20px; font-style:italic; color:#888888; font-family:Arial,sans-serif;">
        No new registrations ${periodLabel}.
      </div>
    `;
  }

  let html = `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;">`;

  registrations.forEach(reg => {
    const location = [reg.city, reg.country].filter(Boolean).join(', ') || 'Location not specified';
    const date = formatDate(reg.created_at);
    html += `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f5f5f5;">
          <span style="font-size:15px; color:#333333; font-weight:500;">${reg.first_name} ${reg.last_name}</span>
        </td>
        <td style="padding:10px 0; border-bottom:1px solid #f5f5f5; text-align:right;">
          <span style="font-size:13px; color:#888888;">${location} · ${date}</span>
        </td>
      </tr>
    `;
  });

  html += `</table>`;
  return html;
};

const getFundsSection = (metrics, periodFunds, periodLabel) => {
  const percentage = Math.round((metrics.totalRaised / FUNDING_TARGET) * 100);
  const progressWidth = Math.min(percentage, 100);

  return `
    <div style="margin:20px 0; font-family:Arial,sans-serif;">
      <div style="margin-bottom:16px;">
        <span style="font-size:36px; font-weight:700; color:#006633; font-family:Georgia,'Times New Roman',serif;">₱${formatCurrency(metrics.totalRaised)}</span>
        <span style="font-size:16px; color:#888888; margin-left:8px;">of ₱${formatCurrency(FUNDING_TARGET)}</span>
      </div>

      <div style="background:#e0e0e0; height:12px; border-radius:6px; overflow:hidden;">
        <div style="background:linear-gradient(to right, #006633, #00994d); height:100%; width:${progressWidth}%; border-radius:6px;"></div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
        <tr>
          <td style="font-size:14px; color:#666666;">${percentage}% of target</td>
          <td style="text-align:right;">
            <span style="font-size:14px; color:${periodFunds > 0 ? '#2e7d32' : '#666666'}; font-weight:600;">
              +₱${formatCurrency(periodFunds)} ${periodLabel}
            </span>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const getBuilderTiersSection = (metrics, prevSnapshot) => {
  const tiers = [
    { name: 'cornerstone', label: 'Cornerstone', color: '#CFB53B', border: true },
    { name: 'pillar', label: 'Pillar', color: '#006633', border: false },
    { name: 'anchor', label: 'Anchor', color: '#1565c0', border: false },
    { name: 'root', label: 'Root', color: '#6d4c41', border: false }
  ];

  let html = `<table width="100%" cellpadding="0" cellspacing="8" style="font-family:Arial,sans-serif;">
    <tr>`;

  tiers.forEach(tier => {
    const current = metrics.tierCounts[tier.name];
    const prev = prevSnapshot ? parseInt(prevSnapshot[`${tier.name}_count`]) || 0 : 0;
    const delta = current - prev;
    const deltaColor = delta > 0 ? '#2e7d32' : '#666666';
    const deltaText = delta > 0 ? `+${delta}` : (delta === 0 ? '—' : delta);

    html += `
      <td width="25%" style="text-align:center; padding:16px 8px; background:#fafafa; border-radius:8px; ${tier.border ? 'border:2px solid #CFB53B;' : ''}">
        <div style="font-size:28px; font-weight:700; color:${tier.color}; font-family:Georgia,'Times New Roman',serif;">${current}</div>
        <div style="font-size:11px; color:#666666; text-transform:uppercase; letter-spacing:1px; margin:4px 0;">${tier.label}</div>
        <div style="font-size:13px; color:${deltaColor}; font-weight:600;">${deltaText}</div>
      </td>
    `;
  });

  html += `</tr></table>`;
  return html;
};

// ============================================================
// WEEKLY EMAIL
// ============================================================

const buildWeeklyEmail = async () => {
  const now = new Date();
  const week = getWeekDateRange(now);
  const metrics = await getCurrentMetrics();
  const prevSnapshot = await getPreviousSnapshot('weekly');
  const newRegistrations = await getNewRegistrations(week.start, week.end);
  const weekFunds = await getFundsInPeriod(week.start, week.end);

  const subject = `Weekly Update: ${metrics.registeredCount} registered, ₱${formatCurrency(metrics.totalRaised)} raised — ${formatDate(week.start)} – ${formatDate(week.end)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background:#f5f5f5;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff;">

        ${getEmailHeader()}

        <div style="padding:32px 28px;">
          <p style="font-size:18px; margin:0 0 8px; font-family:Arial,sans-serif; color:#333333;">
            Hi Committee,
          </p>
          <p style="font-size:15px; margin:0 0 20px; font-family:Arial,sans-serif; color:#666666;">
            Here's your weekly snapshot. Week of ${week.display}.
          </p>

          ${getMomentumBadge('weekly', metrics, prevSnapshot, weekFunds)}

          ${getDashboardButton()}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:28px 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
            Registration
          </h3>

          ${getRegistrationSection(metrics, prevSnapshot)}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:28px 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
            New This Week (+${newRegistrations.length})
          </h3>

          ${getNewRegistrationsList(newRegistrations, 'this week')}

          ${getGoldDivider()}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:0 0 16px; font-family:Arial,sans-serif;">
            Funds Raised
          </h3>

          ${getFundsSection(metrics, weekFunds, 'this week')}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:28px 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
            Builders by Tier
          </h3>

          ${getBuilderTiersSection(metrics, prevSnapshot)}

        </div>

        ${getEmailFooter('weekly')}

      </div>
    </body>
    </html>
  `;

  return { subject, html };
};

// ============================================================
// MONTHLY EMAIL
// ============================================================

const getMonthBanner = (monthYear) => {
  const monthsToGo = getMonthsToGo();
  return `
    <div style="text-align:center; margin:20px 0 28px; padding:24px; background:#fafafa; border-radius:12px; font-family:Arial,sans-serif;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#888888; margin-bottom:8px;">
        MONTHLY REPORT
      </div>
      <div style="font-size:32px; font-weight:700; color:#0a2e1a; font-family:Georgia,'Times New Roman',serif; margin-bottom:8px;">
        ${monthYear}
      </div>
      <div style="font-size:14px; color:#CFB53B; font-weight:600;">
        ${monthsToGo} months to go
      </div>
    </div>
  `;
};

const getAtAGlanceCards = (metrics, prevSnapshot) => {
  const prevReg = prevSnapshot?.registered_count || 0;
  const prevInv = prevSnapshot?.invited_count || 0;
  const regDelta = metrics.registeredCount - prevReg;
  const invDelta = metrics.invitedCount - prevInv;
  const prevPending = prevInv - prevReg;
  const pendingDelta = metrics.pendingCount - prevPending;

  return `
    <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:0 0 16px; font-family:Arial,sans-serif;">
      At a Glance
    </h3>
    <table width="100%" cellpadding="0" cellspacing="8" style="font-family:Arial,sans-serif;">
      <tr>
        <td width="33%" style="text-align:center; padding:20px 12px; background:#e8f5e9; border-radius:8px;">
          <div style="font-size:32px; font-weight:700; color:#006633; font-family:Georgia,'Times New Roman',serif;">${metrics.registeredCount}</div>
          <div style="font-size:12px; color:#666666; text-transform:uppercase; margin:4px 0;">Registered</div>
          <div style="font-size:13px; color:${regDelta > 0 ? '#2e7d32' : '#666666'}; font-weight:600;">
            ${regDelta > 0 ? `+${regDelta}` : '—'} this month
          </div>
        </td>
        <td width="33%" style="text-align:center; padding:20px 12px; background:#fafafa; border-radius:8px;">
          <div style="font-size:32px; font-weight:700; color:#333333; font-family:Georgia,'Times New Roman',serif;">${metrics.invitedCount}</div>
          <div style="font-size:12px; color:#666666; text-transform:uppercase; margin:4px 0;">Invited</div>
          <div style="font-size:13px; color:${invDelta > 0 ? '#2e7d32' : '#666666'}; font-weight:600;">
            ${invDelta > 0 ? `+${invDelta}` : '—'} this month
          </div>
        </td>
        <td width="33%" style="text-align:center; padding:20px 12px; background:#fafafa; border-radius:8px;">
          <div style="font-size:32px; font-weight:700; color:#ff9800; font-family:Georgia,'Times New Roman',serif;">${metrics.pendingCount}</div>
          <div style="font-size:12px; color:#666666; text-transform:uppercase; margin:4px 0;">Pending</div>
          <div style="font-size:13px; color:#666666; font-weight:600;">
            ${pendingDelta === 0 ? '→' : (pendingDelta < 0 ? `${pendingDelta}` : `+${pendingDelta}`)}
          </div>
        </td>
      </tr>
    </table>
  `;
};

const getMonthOverMonthTable = async (thisMonth, prevMonth) => {
  // This month metrics
  const thisRegs = await getNewRegistrations(thisMonth.start, thisMonth.end);
  const thisInvites = await getNewInvites(thisMonth.start, thisMonth.end);
  const thisFunds = await getFundsInPeriod(thisMonth.start, thisMonth.end);
  const thisBuilders = await getNewBuilders(thisMonth.start, thisMonth.end);

  // Previous month metrics
  const prevRegs = await getNewRegistrations(prevMonth.start, prevMonth.end);
  const prevInvites = await getNewInvites(prevMonth.start, prevMonth.end);
  const prevFunds = await getFundsInPeriod(prevMonth.start, prevMonth.end);
  const prevBuilders = await getNewBuilders(prevMonth.start, prevMonth.end);

  const getChangeCell = (current, previous) => {
    if (previous === 0 && current === 0) return '<span style="color:#888888;">—</span>';
    if (previous === 0) return '<span style="color:#2e7d32;">+∞</span>';
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return '<span style="color:#888888;">—</span>';
    const color = pct > 0 ? '#2e7d32' : '#c62828';
    const sign = pct > 0 ? '+' : '';
    return `<span style="color:${color}; font-weight:600;">${sign}${pct}%</span>`;
  };

  return `
    <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:28px 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
      Month over Month
    </h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif; font-size:14px;">
      <tr style="background:#fafafa;">
        <td style="padding:12px; font-weight:600; color:#666666;">Metric</td>
        <td style="padding:12px; text-align:center; font-weight:600; color:#666666;">${formatDate(prevMonth.start, 'month')}</td>
        <td style="padding:12px; text-align:center; font-weight:600; color:#666666;">${formatDate(thisMonth.start, 'month')}</td>
        <td style="padding:12px; text-align:center; font-weight:600; color:#666666;">Change</td>
      </tr>
      <tr>
        <td style="padding:12px; border-bottom:1px solid #eeeeee;">New Registrations</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee;">${prevRegs.length}</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee; font-weight:600;">${thisRegs.length}</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee;">${getChangeCell(thisRegs.length, prevRegs.length)}</td>
      </tr>
      <tr>
        <td style="padding:12px; border-bottom:1px solid #eeeeee;">New Invites Sent</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee;">${prevInvites}</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee; font-weight:600;">${thisInvites}</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee;">${getChangeCell(thisInvites, prevInvites)}</td>
      </tr>
      <tr>
        <td style="padding:12px; border-bottom:1px solid #eeeeee;">Funds Collected</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee;">₱${formatCurrency(prevFunds)}</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee; font-weight:600;">₱${formatCurrency(thisFunds)}</td>
        <td style="padding:12px; text-align:center; border-bottom:1px solid #eeeeee;">${getChangeCell(thisFunds, prevFunds)}</td>
      </tr>
      <tr>
        <td style="padding:12px;">New Builders</td>
        <td style="padding:12px; text-align:center;">${prevBuilders}</td>
        <td style="padding:12px; text-align:center; font-weight:600;">${thisBuilders}</td>
        <td style="padding:12px; text-align:center;">${getChangeCell(thisBuilders, prevBuilders)}</td>
      </tr>
    </table>
  `;
};

const getMonthlyTargetSection = (monthFunds, monthName) => {
  const year = new Date().getFullYear();
  const target = MONTHLY_TARGETS[year] || 55000;
  const percentage = Math.round((monthFunds / target) * 100);
  const metTarget = monthFunds >= target;

  return `
    <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:28px 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
      Monthly Collection vs Target
    </h3>
    <table width="100%" cellpadding="0" cellspacing="8" style="font-family:Arial,sans-serif;">
      <tr>
        <td width="33%" style="text-align:center; padding:20px 12px; background:#fafafa; border-radius:8px;">
          <div style="font-size:24px; font-weight:700; color:${metTarget ? '#2e7d32' : '#c62828'}; font-family:Georgia,'Times New Roman',serif;">
            ₱${formatCurrency(monthFunds)}
          </div>
          <div style="font-size:12px; color:#666666; margin-top:4px;">Collected in ${monthName}</div>
        </td>
        <td width="33%" style="text-align:center; padding:20px 12px; background:#fafafa; border-radius:8px;">
          <div style="font-size:24px; font-weight:700; color:#333333; font-family:Georgia,'Times New Roman',serif;">
            ₱${formatCurrency(target)}
          </div>
          <div style="font-size:12px; color:#666666; margin-top:4px;">Monthly Target</div>
        </td>
        <td width="33%" style="text-align:center; padding:20px 12px; background:#fafafa; border-radius:8px;">
          <div style="font-size:24px; font-weight:700; color:${percentage >= 100 ? '#2e7d32' : '#c62828'}; font-family:Georgia,'Times New Roman',serif;">
            ${percentage}%
          </div>
          <div style="font-size:12px; color:#666666; margin-top:4px;">Of Target</div>
        </td>
      </tr>
    </table>
  `;
};

const getRegisteredInMonthList = (registrations, monthName) => {
  if (!registrations || registrations.length === 0) {
    return `
      <div style="text-align:center; padding:20px; font-style:italic; color:#888888; font-family:Arial,sans-serif;">
        No new registrations in ${monthName}.
      </div>
    `;
  }

  const showAll = registrations.length <= 10;
  const displayRegs = showAll ? registrations : registrations.slice(0, 8);
  const remaining = registrations.length - 8;

  let html = `<table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;">`;

  displayRegs.forEach(reg => {
    const location = [reg.city, reg.country].filter(Boolean).join(', ') || 'Location not specified';
    const date = formatDate(reg.created_at);
    html += `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f5f5f5;">
          <span style="font-size:15px; color:#333333; font-weight:500;">${reg.first_name} ${reg.last_name}</span>
        </td>
        <td style="padding:10px 0; border-bottom:1px solid #f5f5f5; text-align:right;">
          <span style="font-size:13px; color:#888888;">${location} · ${date}</span>
        </td>
      </tr>
    `;
  });

  if (!showAll) {
    html += `
      <tr>
        <td colspan="2" style="padding:12px 0; text-align:center;">
          <span style="font-size:14px; color:#888888; font-style:italic;">+ ${remaining} more</span>
        </td>
      </tr>
    `;
  }

  html += `</table>`;
  return html;
};

const buildMonthlyEmail = async () => {
  const now = new Date();
  const thisMonth = getMonthDateRange(now);
  const prevMonth = getPreviousMonthRange(now);
  const metrics = await getCurrentMetrics();
  const prevSnapshot = await getPreviousSnapshot('monthly');
  const monthRegistrations = await getNewRegistrations(thisMonth.start, thisMonth.end);
  const monthFunds = await getFundsInPeriod(thisMonth.start, thisMonth.end);

  const subject = `Monthly Report: ${thisMonth.monthYear} — ${metrics.registeredCount} registered, ₱${formatCurrency(metrics.totalRaised)} raised`;

  const monthOverMonthHtml = await getMonthOverMonthTable(thisMonth, prevMonth);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background:#f5f5f5;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff;">

        ${getEmailHeader()}

        <div style="padding:32px 28px;">
          <p style="font-size:18px; margin:0 0 8px; font-family:Arial,sans-serif; color:#333333;">
            Hi Committee,
          </p>
          <p style="font-size:15px; margin:0 0 20px; font-family:Arial,sans-serif; color:#666666;">
            Here's your monthly wrap-up for ${thisMonth.monthYear}.
          </p>

          ${getMonthBanner(thisMonth.monthYear)}

          ${getMomentumBadge('monthly', metrics, prevSnapshot, monthFunds)}

          ${getDashboardButton()}

          ${getAtAGlanceCards(metrics, prevSnapshot)}

          ${monthOverMonthHtml}

          ${getGoldDivider()}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:0 0 16px; font-family:Arial,sans-serif;">
            Funds Raised — Cumulative
          </h3>

          ${getFundsSection(metrics, monthFunds, `in ${thisMonth.monthName}`)}

          ${getMonthlyTargetSection(monthFunds, thisMonth.monthName)}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:28px 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
            Builders by Tier
          </h3>

          ${getBuilderTiersSection(metrics, prevSnapshot)}

          ${getGoldDivider()}

          <h3 style="font-size:14px; text-transform:uppercase; letter-spacing:1px; color:#888888; margin:0 0 16px; font-family:Arial,sans-serif; border-bottom:1px solid #eeeeee; padding-bottom:8px;">
            Registered in ${thisMonth.monthName} (+${monthRegistrations.length})
          </h3>

          ${getRegisteredInMonthList(monthRegistrations, thisMonth.monthName)}

        </div>

        ${getEmailFooter('monthly')}

      </div>
    </body>
    </html>
  `;

  return { subject, html };
};

// ============================================================
// EMAIL SENDING
// ============================================================

const sendSummaryEmail = async (type) => {
  try {
    console.log(`[SUMMARY] Building ${type} summary email...`);

    const { subject, html } = type === 'weekly'
      ? await buildWeeklyEmail()
      : await buildMonthlyEmail();

    const msg = {
      to: RECIPIENT_EMAIL,
      from: process.env.FROM_EMAIL,
      subject,
      html
    };

    await sgMail.send(msg);
    console.log(`[SUMMARY] ${type} email sent successfully to ${RECIPIENT_EMAIL}`);

    // Save snapshot after successful send
    await saveSnapshot(type);
    console.log(`[SUMMARY] ${type} snapshot saved`);

    return { success: true };
  } catch (error) {
    console.error(`[SUMMARY] Failed to send ${type} email:`, error.response?.body || error.message);
    return { success: false, error: error.message };
  }
};

// ============================================================
// CRON SCHEDULING
// ============================================================

const isWithinDateRange = (type) => {
  const now = new Date();

  if (type === 'weekly') {
    // March 9, 2026 through December 31, 2028
    const start = new Date(2026, 2, 9); // March 9, 2026
    const end = new Date(2028, 11, 31, 23, 59, 59); // December 31, 2028
    return now >= start && now <= end;
  } else {
    // April 1, 2026 through January 1, 2029
    const start = new Date(2026, 3, 1); // April 1, 2026
    const end = new Date(2029, 0, 1, 23, 59, 59); // January 1, 2029
    return now >= start && now <= end;
  }
};

const initializeSummaryEmails = async () => {
  // Only run in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SUMMARY] Skipping cron initialization (not production)');
    return;
  }

  // Ensure snapshot table exists
  await ensureSnapshotTable();
  console.log('[SUMMARY] Snapshot table ready');

  // Weekly: Every Monday at 8:00 AM PHT (Asia/Manila timezone)
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule('0 8 * * 1', async () => {
    if (!isWithinDateRange('weekly')) {
      console.log('[SUMMARY] Weekly email skipped (outside date range)');
      return;
    }
    await sendSummaryEmail('weekly');
  }, {
    timezone: 'Asia/Manila'
  });
  console.log('[SUMMARY] Weekly cron scheduled: Every Monday 8:00 AM PHT');

  // Monthly: 1st of every month at 8:00 AM PHT
  cron.schedule('0 8 1 * *', async () => {
    if (!isWithinDateRange('monthly')) {
      console.log('[SUMMARY] Monthly email skipped (outside date range)');
      return;
    }
    await sendSummaryEmail('monthly');
  }, {
    timezone: 'Asia/Manila'
  });
  console.log('[SUMMARY] Monthly cron scheduled: 1st of every month 8:00 AM PHT');
};

// Export for testing
module.exports = {
  initializeSummaryEmails,
  sendSummaryEmail,
  buildWeeklyEmail,
  buildMonthlyEmail,
  getCurrentMetrics,
  ensureSnapshotTable
};
