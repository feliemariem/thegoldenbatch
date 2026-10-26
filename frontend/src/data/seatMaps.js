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

export const SEAT_MAPS = { C3, C4 };

export function getSeatMap(layout) {
  return SEAT_MAPS[layout] || null;
}
