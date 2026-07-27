import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../api';
import Navbar from '../components/Navbar';

// ---- Seat maps copied from SeatPicker.js (Ayala blueprints) ----
const C3_COLS = 26;
function c3full(letter) {
  const c = {};
  [1, 2, 3, 4, 5, 6].forEach((s, i) => c[i + 1] = s);
  for (let s = 7; s <= 17; s++) c[s + 1] = s;
  for (let s = 18; s <= 24; s++) c[s + 2] = s;
  return { letter, cols: c };
}
function c3short(letter) {
  const c = {};
  c[3] = 1; c[4] = 2; c[5] = 3; c[6] = 4;
  for (let s = 5; s <= 15; s++) c[s + 3] = s;
  c[20] = 16; c[21] = 17; c[22] = 18; c[23] = 19; c[24] = 20;
  return { letter, cols: c };
}
const C3 = {
  name: "Cinema 3", cols: C3_COLS,
  rows: [
    c3full("O"), c3full("N"), c3full("M"), c3full("L"), c3full("K"), c3full("J"), c3full("I"),
    c3short("H"), c3short("G"), c3short("F"), c3short("E"), c3short("D"), c3short("C"), c3short("B"),
    { letter: "A", cols: { 3: 1, 4: 2, 9: 3, 10: 4, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9, 16: 10, 22: 11, 23: 12, 24: 13 } }
  ]
};

const C4_COLS = 21;
function c4big(letter) {
  const c = {};
  for (let s = 1; s <= 5; s++) c[s] = s;
  for (let s = 6; s <= 14; s++) c[s + 1] = s;
  for (let s = 15; s <= 19; s++) c[s + 2] = s;
  return { letter, cols: c };
}
function c4mid(letter) {
  const c = {};
  c[4] = 1; c[5] = 2;
  for (let s = 3; s <= 11; s++) c[s + 4] = s;
  c[17] = 12; c[18] = 13;
  return { letter, cols: c };
}
const C4 = {
  name: "Cinema 4", cols: C4_COLS,
  rows: [
    { letter: "J", cols: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 17: 12, 18: 13, 19: 14, 20: 15, 21: 16 } },
    c4big("I"), c4big("H"), c4big("G"),
    c4mid("F"), c4mid("E"), c4mid("D"), c4mid("C"), c4mid("B"),
    { letter: "A", cols: { 7: 1, 8: 2, 9: 3, 10: 4, 11: 5, 12: 6, 13: 7, 14: 8, 15: 9 } }
  ]
};

const MAPS = { C3, C4 };

export default function AdminSeats() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [event, setEvent] = useState(null);
  const [seatMap, setSeatMap] = useState({});
  const [cinemas, setCinemas] = useState([]);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/profile');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch active event
      const eventRes = await apiGet('/api/movie-screening/active');
      const eventData = await eventRes.json();

      if (!eventRes.ok) {
        setError(eventData.error || 'Failed to load event');
        setLoading(false);
        return;
      }

      if (!eventData.event) {
        setLoading(false);
        return;
      }

      setEvent(eventData.event);

      // Fetch seat map
      const seatsRes = await apiGet(`/api/movie-screening/admin/seats?event_id=${eventData.event.id}`);
      const seatsData = await seatsRes.json();

      if (!seatsRes.ok) {
        setError(seatsData.error || 'Failed to load seat map');
        setLoading(false);
        return;
      }

      setSeatMap(seatsData.seatMap || {});
      setCinemas(seatsData.cinemas || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
      setLoading(false);
    }
  }, []);

  const handleSeatHover = (e, cinemaCode, seatId) => {
    const key = `${cinemaCode}:${seatId}`;
    const info = seatMap[key];
    if (info) {
      const rect = e.target.getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top,
        seatId,
        ...info
      });
    }
  };

  const handleSeatLeave = () => {
    setTooltip(null);
  };

  // Count seats for a cinema
  const countSeats = (cinemaCode) => {
    const map = MAPS[cinemaCode];
    if (!map) return { total: 0, reserved: 0, available: 0 };

    let total = 0;
    let reserved = 0;

    for (const row of map.rows) {
      for (const col in row.cols) {
        total++;
        const seatId = `${row.letter}${row.cols[col]}`;
        const key = `${cinemaCode}:${seatId}`;
        if (seatMap[key]) reserved++;
      }
    }

    return { total, reserved, available: total - reserved };
  };

  // Styles matching SeatPicker.js
  const styles = {
    body: {
      background: '#f4f4f0',
      color: '#1a1a1a',
      fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      minHeight: '100vh'
    },
    wrap: {
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '20px'
    },
    card: {
      background: '#fff',
      borderRadius: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,.08)',
      overflow: 'hidden'
    },
    head: {
      background: '#006633',
      color: '#fff',
      padding: '14px 18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '8px'
    },
    legend: {
      display: 'flex',
      gap: '18px',
      padding: '10px 18px',
      fontSize: '12px',
      borderBottom: '1px solid #eee',
      flexWrap: 'wrap'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    swatch: {
      width: '16px',
      height: '16px',
      borderRadius: '3px',
      display: 'inline-block'
    },
    swAvail: {
      background: '#fff',
      border: '1.5px solid #006633'
    },
    swTaken: {
      background: '#c9c9c9'
    },
    cinemasWrap: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '24px',
      padding: '18px'
    },
    cinemaBox: {
      background: '#fafafa',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #eee'
    },
    cinemaTitle: {
      fontSize: '16px',
      fontWeight: 600,
      marginBottom: '12px',
      color: '#006633',
      textAlign: 'center'
    },
    screenwrap: {
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch'
    },
    map: {
      display: 'inline-block'
    },
    maprow: {
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      marginBottom: '3px'
    },
    rowlabel: {
      width: '20px',
      textAlign: 'center',
      fontWeight: 600,
      fontSize: '12px',
      color: '#555',
      flex: '0 0 20px'
    },
    cell: {
      width: '26px',
      height: '26px',
      flex: '0 0 26px'
    },
    seat: {
      width: '26px',
      height: '26px',
      borderRadius: '4px',
      border: '1.5px solid #006633',
      background: '#fff',
      color: '#1a1a1a',
      fontSize: '10px',
      cursor: 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      transition: 'transform .05s'
    },
    seatTaken: {
      background: '#c9c9c9',
      borderColor: '#c9c9c9',
      color: '#666',
      cursor: 'pointer'
    },
    screen: {
      margin: '14px auto 2px',
      width: '45%',
      textAlign: 'center',
      background: 'linear-gradient(#ddd, #f4f4f0)',
      borderTop: '3px solid #999',
      borderRadius: '0 0 40px 40px / 0 0 12px 12px',
      padding: '4px',
      fontSize: '11px',
      letterSpacing: '3px',
      color: '#888'
    },
    stats: {
      display: 'flex',
      justifyContent: 'center',
      gap: '24px',
      marginTop: '16px',
      paddingTop: '12px',
      borderTop: '1px solid #eee',
      fontSize: '13px'
    },
    statItem: {
      textAlign: 'center'
    },
    statNum: {
      fontWeight: 700,
      fontSize: '18px',
      color: '#006633'
    },
    statLabel: {
      color: '#666',
      fontSize: '11px',
      marginTop: '2px'
    },
    tooltip: {
      position: 'fixed',
      transform: 'translate(-50%, -100%)',
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000,
      minWidth: '180px',
      pointerEvents: 'none'
    },
    tooltipSeat: {
      fontWeight: 600,
      marginBottom: '8px',
      color: '#1a1a1a',
      fontSize: '14px'
    },
    tooltipName: {
      fontSize: '13px',
      color: '#1a1a1a',
      marginBottom: '4px'
    },
    tooltipContact: {
      fontSize: '12px',
      color: '#666',
      fontFamily: 'monospace'
    },
    tooltipBadge: {
      marginTop: '8px',
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '4px',
      display: 'inline-block'
    },
    errorBox: {
      maxWidth: '480px',
      margin: '60px auto',
      background: '#fff',
      border: '1px solid #e2e2e2',
      borderRadius: '10px',
      padding: '40px',
      textAlign: 'center'
    }
  };

  const renderCinema = (cinemaCode) => {
    const cinemaMap = MAPS[cinemaCode];
    if (!cinemaMap) return null;

    const cinema = cinemas.find(c => c.code === cinemaCode);
    const counts = countSeats(cinemaCode);

    return (
      <div key={cinemaCode} style={styles.cinemaBox}>
        <div style={styles.cinemaTitle}>
          {cinemaMap.name}
          {cinema && <span style={{ fontWeight: 400, color: '#666' }}> ({cinema.label})</span>}
        </div>

        <div style={styles.screenwrap}>
          <div style={styles.map}>
            {cinemaMap.rows.map((row) => (
              <div key={row.letter} style={styles.maprow}>
                <div style={styles.rowlabel}>{row.letter}</div>
                {Array.from({ length: cinemaMap.cols }, (_, i) => i + 1).map((col) => {
                  const seatNum = row.cols[col];
                  if (seatNum === undefined) {
                    return <div key={col} style={styles.cell}></div>;
                  }
                  const seatId = `${row.letter}${seatNum}`;
                  const key = `${cinemaCode}:${seatId}`;
                  const isTaken = !!seatMap[key];

                  let seatStyle = { ...styles.seat };
                  if (isTaken) {
                    seatStyle = { ...seatStyle, ...styles.seatTaken };
                  }

                  return (
                    <div key={col} style={styles.cell}>
                      <div
                        style={seatStyle}
                        onMouseEnter={(e) => isTaken && handleSeatHover(e, cinemaCode, seatId)}
                        onMouseLeave={handleSeatLeave}
                      >
                        {seatNum}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={styles.screen}>--- SCREEN ---</div>
          </div>
        </div>

        <div style={styles.stats}>
          <div style={styles.statItem}>
            <div style={styles.statNum}>{counts.available}</div>
            <div style={styles.statLabel}>Available</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ ...styles.statNum, color: '#666' }}>{counts.reserved}</div>
            <div style={styles.statLabel}>Reserved</div>
          </div>
          <div style={styles.statItem}>
            <div style={{ ...styles.statNum, color: '#333' }}>{counts.total}</div>
            <div style={styles.statLabel}>Total</div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={styles.body}>
          <div style={styles.wrap}>
            <div style={{ ...styles.card, padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#555' }}>Loading seat map...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div style={styles.body}>
          <div style={styles.wrap}>
            <div style={styles.errorBox}>
              <p style={{ color: '#555' }}>{error}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <Navbar />
        <div style={styles.body}>
          <div style={styles.wrap}>
            <div style={styles.errorBox}>
              <p style={{ color: '#555' }}>No active screening event.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={styles.body}>
        <div style={styles.wrap}>
          <div style={styles.card}>
            <div style={styles.head}>
              <div style={{ fontSize: '15px' }}>
                Seat Inventory for <b style={{ color: '#CFB53B' }}>{event.title}</b>
                {event.subtitle && <span> - {event.subtitle}</span>}
              </div>
            </div>

            <div style={styles.legend}>
              <span style={styles.legendItem}>
                <i style={{ ...styles.swatch, ...styles.swAvail }}></i> Available
              </span>
              <span style={styles.legendItem}>
                <i style={{ ...styles.swatch, ...styles.swTaken }}></i> Reserved
              </span>
            </div>

            <div style={styles.cinemasWrap}>
              {renderCinema('C3')}
              {renderCinema('C4')}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{ ...styles.tooltip, left: tooltip.x, top: tooltip.y - 10 }}>
          <div style={styles.tooltipSeat}>Seat {tooltip.seatId}</div>
          <div style={styles.tooltipName}>{tooltip.buyer_name}</div>
          {tooltip.mobile && (
            <div style={styles.tooltipContact}>{tooltip.mobile}</div>
          )}
          {tooltip.email && (
            <div style={{ ...styles.tooltipContact, fontFamily: 'inherit' }}>{tooltip.email}</div>
          )}
          <div style={{
            ...styles.tooltipBadge,
            background: tooltip.status === 'confirmed' ? 'rgba(4, 120, 87, 0.1)' : 'rgba(180, 83, 9, 0.1)',
            color: tooltip.status === 'confirmed' ? '#047857' : '#b45309'
          }}>
            {tooltip.status === 'confirmed' ? 'Confirmed' : 'Pending'}
          </div>
          {tooltip.is_sponsor && (
            <div style={{
              ...styles.tooltipBadge,
              marginLeft: '4px',
              background: 'rgba(0, 102, 51, 0.1)',
              color: '#006633'
            }}>
              Sponsor{tooltip.sponsor_type ? ` (${tooltip.sponsor_type})` : ''}
            </div>
          )}
        </div>
      )}
    </>
  );
}
