import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost } from '../api';

// ---- Seat maps copied from the Ayala blueprints (letter + seat number) ----
// Each row: {letter, cols: {columnIndex: seatNumber}} ; blank columns = gap.

const C3_COLS = 26;
function c3full(letter) { // rows O..I : seats 1-24
  const c = {};
  [1, 2, 3, 4, 5, 6].forEach((s, i) => c[i + 1] = s);      // left cols 1-6
  for (let s = 7; s <= 17; s++) c[s + 1] = s;              // middle cols 8-18
  for (let s = 18; s <= 24; s++) c[s + 2] = s;             // right cols 20-26
  return { letter, cols: c };
}
function c3short(letter) { // rows H..B : seats 1-20
  const c = {};
  c[3] = 1; c[4] = 2; c[5] = 3; c[6] = 4;                  // left, shifted right
  for (let s = 5; s <= 15; s++) c[s + 3] = s;              // middle cols 8-18
  c[20] = 16; c[21] = 17; c[22] = 18; c[23] = 19; c[24] = 20; // right cols 20-24
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
function c4big(letter) { // rows I,H,G : seats 1-19
  const c = {};
  for (let s = 1; s <= 5; s++) c[s] = s;                   // left cols 1-5
  for (let s = 6; s <= 14; s++) c[s + 1] = s;              // middle cols 7-15
  for (let s = 15; s <= 19; s++) c[s + 2] = s;             // right cols 17-21
  return { letter, cols: c };
}
function c4mid(letter) { // rows F,E,D,C,B : seats 1-13
  const c = {};
  c[4] = 1; c[5] = 2;                                      // left pair
  for (let s = 3; s <= 11; s++) c[s + 4] = s;              // middle cols 7-15
  c[17] = 12; c[18] = 13;                                  // right pair
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

// Sort seats by row letter then number
function seatSort(a, b) {
  const ra = a.match(/[A-Z]+/)[0], rb = b.match(/[A-Z]+/)[0];
  if (ra !== rb) return ra < rb ? -1 : 1;
  return parseInt(a.replace(/[A-Z]+/, '')) - parseInt(b.replace(/[A-Z]+/, ''));
}

export default function SeatPicker() {
  const { token } = useParams();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [takenSeats, setTakenSeats] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Fetch seat picker data
  const fetchData = useCallback(async () => {
    try {
      const res = await apiGet(`/api/movie-screening/seats/${token}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'An error occurred');
        setLoading(false);
        return;
      }

      // Already reserved - show read-only confirmation
      if (json.alreadyReserved) {
        setConfirmed(true);
        setConfirmData({
          buyer_name: json.buyer_name,
          cinema_code: json.cinema_code,
          quantity: json.quantity,
          chosen_seats: json.chosen_seats,
          gcash_ref: json.gcash_ref,
          alreadyReserved: true
        });
        setLoading(false);
        return;
      }

      setData(json);
      setTakenSeats(new Set(json.taken_seats || []));
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle seat selection
  const toggleSeat = (seatId) => {
    if (takenSeats.has(seatId)) return;

    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        if (next.size >= data.quantity) return prev;
        next.add(seatId);
      }
      return next;
    });
  };

  // Confirm seats
  const handleConfirm = async () => {
    if (selected.size !== data.quantity) return;

    setConfirming(true);
    const seats = [...selected].sort(seatSort);

    try {
      const res = await apiPost(`/api/movie-screening/seats/${token}/confirm`, { seats });
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409 && json.error.includes('just taken')) {
          alert(json.error);
          // Refetch to update taken seats
          setSelected(new Set());
          await fetchData();
        } else {
          alert(json.error || 'Failed to confirm seats');
        }
        setConfirming(false);
        return;
      }

      setConfirmed(true);
      setConfirmData({
        buyer_name: json.buyer_name,
        cinema_code: json.cinema_code,
        quantity: json.quantity,
        chosen_seats: json.chosen_seats,
        gcash_ref: json.gcash_ref
      });
    } catch (err) {
      console.error(err);
      alert('Failed to confirm seats');
    } finally {
      setConfirming(false);
    }
  };

  // Get cinema name
  const getCinemaName = (code) => {
    if (code === 'C3') return 'Cinema 3';
    if (code === 'C4') return 'Cinema 4';
    return code;
  };

  // Styles matching the mockup exactly
  const styles = {
    body: {
      margin: 0,
      background: '#f4f4f0',
      color: '#1a1a1a',
      fontFamily: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      padding: '20px',
      minHeight: '100vh',
      boxSizing: 'border-box'
    },
    wrap: {
      maxWidth: '900px',
      margin: '0 auto'
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
    who: {
      fontSize: '15px'
    },
    whoName: {
      color: '#CFB53B'
    },
    count: {
      fontSize: '14px',
      background: 'rgba(255,255,255,.15)',
      padding: '6px 12px',
      borderRadius: '20px',
      fontVariantNumeric: 'tabular-nums'
    },
    countFull: {
      background: '#CFB53B',
      color: '#1a1a1a',
      fontWeight: 600
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
    swSel: {
      background: '#006633'
    },
    swTaken: {
      background: '#c9c9c9'
    },
    screenwrap: {
      padding: '18px',
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
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      transition: 'transform .05s'
    },
    seatSel: {
      background: '#006633',
      color: '#fff',
      borderColor: '#006633'
    },
    seatTaken: {
      background: '#c9c9c9',
      borderColor: '#c9c9c9',
      color: '#8a8a8a',
      cursor: 'not-allowed'
    },
    seatDisabled: {
      opacity: 0.4,
      cursor: 'not-allowed'
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
    foot: {
      padding: '14px 18px',
      borderTop: '1px solid #eee',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap'
    },
    picked: {
      fontSize: '13px',
      color: '#333'
    },
    pickedSeats: {
      color: '#006633',
      fontWeight: 600
    },
    confirm: {
      background: '#CFB53B',
      color: '#1a1a1a',
      border: 'none',
      padding: '10px 22px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer'
    },
    confirmDisabled: {
      opacity: 0.4,
      cursor: 'not-allowed'
    },
    timer: {
      fontSize: '13px',
      color: '#b91c1c',
      fontWeight: 500,
      background: '#fff',
      padding: '4px 12px',
      borderRadius: '20px'
    },
    timerLow: {
      color: '#b91c1c'
    },
    // Summary styles
    summary: {
      maxWidth: '480px',
      marginLeft: 'auto',
      marginRight: 'auto',
      background: '#fff',
      border: '1px solid #e2e2e2'
    },
    sumHead: {
      padding: '26px 30px 6px',
      textAlign: 'center'
    },
    sumBrand: {
      fontFamily: "'Poppins', sans-serif",
      fontSize: '11px',
      letterSpacing: '1.5px',
      fontWeight: 600,
      color: '#1a1a1a',
      textTransform: 'uppercase'
    },
    sumTitle: {
      fontFamily: "'Gelasio', Georgia, serif",
      fontSize: '25px',
      fontWeight: 700,
      margin: '10px 0 8px',
      color: '#1a1a1a',
      lineHeight: 1.15
    },
    sumSub: {
      fontFamily: "'Poppins', sans-serif",
      fontSize: '13px',
      color: '#333',
      lineHeight: 1.6
    },
    sumBody: {
      padding: '10px 30px 24px'
    },
    sumSection: {
      fontFamily: "'Gelasio', Georgia, serif",
      fontSize: '14px',
      fontWeight: 700,
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      borderTop: '1px solid #ddd',
      paddingTop: '20px',
      marginBottom: '4px'
    },
    sumRow: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '14px',
      padding: '13px 0',
      borderBottom: '1px solid #eee',
      fontSize: '14px',
      fontFamily: "'Poppins', sans-serif"
    },
    sumRowLabel: {
      color: '#555'
    },
    sumRowValue: {
      textAlign: 'right',
      color: '#1a1a1a',
      fontWeight: 600
    },
    sumNote: {
      marginTop: '16px',
      fontSize: '12.5px',
      color: '#555',
      lineHeight: 1.6,
      fontFamily: "'Poppins', sans-serif"
    },
    sumFootNote: {
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: '1px solid #ddd',
      textAlign: 'center',
      fontSize: '12.5px',
      color: '#555',
      fontFamily: "'Poppins', sans-serif"
    },
    sumFoot: {
      padding: '0 30px 24px',
      textAlign: 'center'
    },
    errorBox: {
      maxWidth: '480px',
      margin: '60px auto',
      background: '#fff',
      border: '1px solid #e2e2e2',
      borderRadius: '10px',
      padding: '40px',
      textAlign: 'center'
    },
    errorText: {
      fontSize: '16px',
      color: '#555',
      lineHeight: 1.6
    },
    expiredOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(255,255,255,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '10px'
    },
    expiredText: {
      fontSize: '16px',
      color: '#b91c1c',
      fontWeight: 500,
      textAlign: 'center',
      padding: '20px'
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.body}>
        <div style={styles.wrap}>
          <div style={{ ...styles.card, padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#555' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.body}>
        <div style={styles.wrap}>
          <div style={styles.errorBox}>
            <p style={styles.errorText}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation summary (after confirm or alreadyReserved)
  if (confirmed && confirmData) {
    return (
      <div style={styles.body}>
        <link href="https://fonts.googleapis.com/css2?family=Gelasio:wght@400;600;700&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <div style={styles.wrap}>
          <div style={{ ...styles.card, ...styles.summary }}>
            <div style={styles.sumHead}>
              <div style={styles.sumBrand}>USLS-IS Batch 2003 · Block Screening</div>
              <div style={styles.sumTitle}>Spider-Man: Brand New Day</div>
              <div style={styles.sumSub}>Friday · July 31, 2026</div>
              <div style={styles.sumSub}>Ayala Malls Capitol Central · Bacolod</div>
            </div>
            <div style={styles.sumBody}>
              <div style={styles.sumSection}>
                {confirmData.alreadyReserved ? 'Your Seats Have Been Reserved' : 'Seat Confirmation'}
              </div>
              <div style={styles.sumRow}>
                <span style={styles.sumRowLabel}>Name</span>
                <b style={styles.sumRowValue}>{confirmData.buyer_name}</b>
              </div>
              <div style={styles.sumRow}>
                <span style={styles.sumRowLabel}>Cinema</span>
                <b style={styles.sumRowValue}>{getCinemaName(confirmData.cinema_code)}</b>
              </div>
              <div style={styles.sumRow}>
                <span style={styles.sumRowLabel}>Seats</span>
                <b style={styles.sumRowValue}>{confirmData.chosen_seats}</b>
              </div>
              <div style={styles.sumRow}>
                <span style={styles.sumRowLabel}>Total seats</span>
                <b style={styles.sumRowValue}>{confirmData.quantity}</b>
              </div>
              {confirmData.gcash_ref && (
                <div style={styles.sumRow}>
                  <span style={styles.sumRowLabel}>Reference No.</span>
                  <b style={styles.sumRowValue}>{confirmData.gcash_ref}</b>
                </div>
              )}
              <div style={styles.sumNote}>
                Bring this with your Batch 2003 ticket stubs on screening day. Your reserved seats will be ready for you at the venue.
              </div>
              <div style={styles.sumFootNote}>
                Questions? Email us at <a href="mailto:uslsis.batch2003@gmail.com" style={{ color: '#006633' }}>uslsis.batch2003@gmail.com</a>
              </div>
            </div>
            <div style={styles.sumFoot}>
              <button style={styles.confirm} onClick={() => window.print()}>
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
        <style>{`
          @media print {
            body { background: #fff !important; padding: 0 !important; }
          }
        `}</style>
      </div>
    );
  }

  // Get the cinema map
  const cinemaMap = MAPS[data.cinema_code] || C3;
  const selectedList = [...selected].sort(seatSort);
  const isFull = selected.size === data.quantity;

  return (
    <div style={styles.body}>
      <div style={styles.wrap}>
        <div style={{ ...styles.card, position: 'relative' }}>
          <div style={styles.head}>
            <div style={styles.who}>
              Seat selection for <b style={styles.whoName}>{data.buyer_name}</b> · <span>{getCinemaName(data.cinema_code)}</span>
            </div>
            <div style={{ ...styles.count, ...(isFull ? styles.countFull : {}) }}>
              Selected {selected.size} of {data.quantity}
            </div>
          </div>

          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <i style={{ ...styles.swatch, ...styles.swAvail }}></i> Available
            </span>
            <span style={styles.legendItem}>
              <i style={{ ...styles.swatch, ...styles.swSel }}></i> Your selection
            </span>
            <span style={styles.legendItem}>
              <i style={{ ...styles.swatch, ...styles.swTaken }}></i> Taken
            </span>
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
                    const isTaken = takenSeats.has(seatId);
                    const isSelected = selected.has(seatId);
                    const isDisabledByFull = isFull && !isSelected;

                    let seatStyle = { ...styles.seat };
                    if (isTaken) {
                      seatStyle = { ...seatStyle, ...styles.seatTaken };
                    } else if (isSelected) {
                      seatStyle = { ...seatStyle, ...styles.seatSel };
                    } else if (isDisabledByFull) {
                      seatStyle = { ...seatStyle, ...styles.seatDisabled };
                    }

                    return (
                      <div key={col} style={styles.cell}>
                        <button
                          style={seatStyle}
                          onClick={() => !isTaken && toggleSeat(seatId)}
                          disabled={isTaken}
                          onMouseEnter={(e) => {
                            if (!isTaken && !isDisabledByFull) {
                              e.target.style.transform = 'scale(1.12)';
                              e.target.style.zIndex = '2';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.zIndex = '0';
                          }}
                        >
                          {seatNum}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div style={styles.screen}>--- SCREEN ---</div>
            </div>
          </div>

          <div style={styles.foot}>
            <div style={styles.picked}>
              Your seats: <b style={styles.pickedSeats}>{selectedList.length ? selectedList.join(', ') : 'none yet'}</b>
            </div>
            <button
              style={{ ...styles.confirm, ...(!isFull || confirming ? styles.confirmDisabled : {}) }}
              disabled={!isFull || confirming}
              onClick={handleConfirm}
            >
              {confirming ? 'Confirming...' : 'Confirm seats'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
