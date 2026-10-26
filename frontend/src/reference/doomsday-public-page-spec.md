# Doomsday Public Page Spec (source of truth)

File to rebuild: `frontend/src/pages/MovieScreening.js` and `frontend/src/styles/movieScreening.css`.
Follow this document exactly. Copy strings are exact; do not reword them. No em dashes anywhere.

---

## KEEP

- The existing GET /active load, loading state, and the "no active event" screen.
- The GCash QR image: `import gcashQr from '../images/gcash-qr.png';`
- Footer and page wrapper.

## REMOVE from this page

- Committee Access button, passcode prompt, the entire physical sale form, and all their state and handlers. Delete `normalizePHMobile` if nothing else on the page uses it. Backend routes stay untouched.
- Hardcoded "Ayala Malls Cinema · Bacolod", any Spider-Man copy, the old inclusions text, and the sold-out banner.
- Any `cinemaCode === 'C3' ? 321 : 147` fallbacks. Use `capacity` and `seats_left` from the API.

---

## DATA

From `GET /api/movie-screening/active`:

- `event`: id, title, event_date (DATE, e.g. 2026-12-18), venue, gcash_number, gcash_name
- `cinemas[]` (already sorted): code (`C4A`, `C3`, `C4B`), label (`Cinema 4` / `Cinema 3`), showtime (`3:25 PM`), unit_price (600), capacity, seats_left, layout (`C3` or `C4`), sort_order

Seat maps: `import { getSeatMap } from '../data/seatMaps';` then `getSeatMap(cinema.layout)`.
Shape: `{ name, cols, rows: [{ letter, cols: { columnIndex: seatNumber } }] }`.
Columns are 1-based. A column index missing from `row.cols` is an aisle gap (render an empty cell).
Seat label = `letter + seatNumber` (e.g. `F12`). Render rows in array order (back row first, Row A last)
and place the screen indicator the same way `SeatPicker.js` does.

Backend routes (already built):

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/movie-screening/seats/taken` | `?cinema_code=X&hold_token=Y` | `{ taken: [], mine: [], expires_at }` |
| POST | `/api/movie-screening/holds` | `{ cinema_code, quantity, seats: [], hold_token? }` | `{ hold_token, expires_at, held: [], unavailable: [] }`, or 410 `{ error: 'expired' }` |
| DELETE | `/api/movie-screening/holds/:token` | | `{ released }` |
| POST | `/api/movie-screening/reserve` | `{ cinema_code, buyer_name, email, mobile?, quantity, gcash_ref, hold_token, sold_by_team }` | reservation, or 409 `{ error }` |

`apiGet` / `apiPost` return the raw Response: check `res.ok` / `res.status`, then `.json()`.

---

## LAYOUT, TOP TO BOTTOM

### HERO (always shown)

- Film strip border directly above and below the hero: a row of small rectangular perforations (like the old page), color #34403A on #090C0A, about 30px tall.
- Pill: `USLS-IS BATCH 2003 · BLOCK SCREENING` (bg #10251A, border #2F6B40, text #7BD892, uppercase, letter-spaced).
- Title: `event.title` in Cinzel 700, silver #DCE2DD, large (about 72px desktop, scales down on mobile). A 5px green (#4CC16A) vertical bar sits to the left of the title, full title height, rounded.
- Date line: calendar icon + `Friday · December 18, 2026` built from `event.event_date` (weekday · Month D, YYYY). Parse the DATE string without timezone shift. Green #4CC16A, semibold, about 32px.
- Venue line: map pin icon + `event.venue`. Text #DCE2DD, about 18px.
- Background: #070A08 with a soft green radial glow toward the right (rgba(60,160,80,0.20) fading to transparent).

### INCLUSIONS (always shown)

- One block, no cards. Soft green radial glow in the bottom right corner on #0A0E0B, radius 16px.
- Line 1: ticket icon (green) + **`Inclusions`** (green #4CC16A, semibold) + ` · your movie stub, popcorn, and a drink.` (#DCE2DD), about 24px.
- Line 2: `Choose your showtime and seats below.` (muted #A7B0AA, about 17px).

### PROGRESS

- Three labels in a row: `1 · Showtime`, `2 · Seats`, `3 · Details and payment`.
- Current step #4CC16A, completed steps #A7B0AA, upcoming #5E6E63. Not clickable.

### STEP 1: SHOWTIME

- Card heading: `Choose your showtime`
- One button-card per cinema, in a responsive grid:
  - showtime (Cinzel 700, about 28px, #DCE2DD)
  - label (e.g. `Cinema 4`)
  - `{seats_left} seats left` (#7BD892)
  - thin divider, then `₱{unit_price}` (semibold, about 18px)
  - Selected card: green border #4CC16A, bg #10251A. `seats_left === 0`: disabled, shows `Sold out` instead of seats left.
- Clicking a card only selects it. It does NOT advance.
- Once a card is selected, show below a divider:
  - `Tickets` label, `−` button, count, `+` button (min 1, max = seats_left of that showtime; no other cap)
  - `Total ₱X` (formatted with commas)
  - Primary button `Choose seats`
  - Note: `You will have 10 minutes to choose your seats and complete payment.`

### STEP 2: SEATS

- Heading: `Choose {qty} seats`. Subline: `{label} · {showtime}`.
- Timer pill on the right: `Seats held for M:SS`. Normal: bg #10251A, border #2F6B40, text #7BD892. At 60 seconds or less: bg #2A1414, border #7A2E2E, text #F08A8A.
- On entering step 2: GET `/seats/taken`, start a provisional 10:00 countdown. Re-fetch taken seats every 15 seconds while on step 2.
- Seat click: toggle. If already at qty and the click is on a new seat, drop the oldest selected seat and add the new one. After every change, POST `/holds` with the full seat list (and `hold_token` once one exists). Save `hold_token`; from then on the timer follows the server's `expires_at`.
- If `unavailable` is not empty: remove those seats from the selection, mark them taken, show `Seat {X} was just taken. Please pick another.`
- 410 from `/holds`: go to the EXPIRED screen.
- Seats: 24px buttons, small seat number inside. Available = outline #5E6E63; selected = fill #4CC16A with text #05140A; taken = fill #262C28, disabled. `aria-label`: `Seat F12 available` / `selected` / `taken`. Row letter on both ends of each row.
- Under the screen indicator: legend with swatches `Available`, `Your seats`, `Taken`.
- The grid sits in a horizontally scrollable box so it works on phones.
- Bottom bar: `Selected N of {qty}` + sorted seat list (or `None yet`), text link `Change showtime` (DELETE the hold, back to step 1, keep the showtime selected), primary button `Continue` (enabled only when the server-held seat count equals qty).

### STEP 3: DETAILS AND PAYMENT

- Heading: `Your details and payment`. Subline: `{label} · {showtime} · Seats {sorted list}`. Same timer pill, still counting.
- Fields (labels exact):
  - `Full name` (required)
  - `Email` (required, placeholder `you@email.com`)
  - `Phone (optional)` (type tel, placeholder `+63 917 123 4567`). Helper text below: `Any country is fine. Include your country code.`
- Radio group, legend `Who sold you this ticket?`, none preselected, required:
  - `USLS-IS Batch 2003` (value `batch2003`)
  - `Liceo Student Government` (value `liceo`)
- Payment block:
  - The existing GCash QR image (`gcashQr`).
  - `Amount to send`, then the total (Cinzel, green #4CC16A, large), then `{qty} tickets × ₱{unit_price}`.
  - `GCash name: {event.gcash_name}` and `GCash number: {event.gcash_number}`.
  - Field `GCash reference number` (required).
- Text link `Back to seats` (keeps the hold). Primary button `Submit reservation`, disabled until: name filled, valid email, phone empty or valid, sold-by chosen, reference filled.
- Submit: POST `/reserve`. On 409 whose error mentions `expired`: go to EXPIRED. Any other error: show the server's message inline above the button.

### EXPIRED (timer hits 0 on step 2 or 3, or any 410)

- DELETE the hold.
- Card with red-tinted border #7A2E2E. Heading `Time is up` (#F08A8A). Text: `Your seats were released so others can choose them. You can start again anytime.` Button `Start again` (back to step 1, same showtime still selected, re-fetch /active).

### DONE (after successful reserve)

- Card with green border #2F6B40.
- Heading: `Reservation received` (#7BD892).
- Then: `Thank you, {first name}!` (first word of the full name, semibold).
- Then: `We will verify your payment within 48 hours and send your confirmation to {email}.`
- Summary grid, label above value: `Name`, `Showtime` (`{label} · {showtime}`), `Tickets`, `Seats`, `Total`, `Reference` (the GCash reference), `Sold by` (`USLS-IS Batch 2003` or `Liceo Student Government`).
- Buttons: primary `Print or save as PDF` (`window.print()`), text link `Make another reservation` (full reset, re-fetch /active).
- Print styles (`@media print`): only the receipt prints, black text on white, buttons hidden. Print-only header: `USLS-IS BATCH 2003 · BLOCK SCREENING`, event title, `{date} · {venue}`. Print-only footer: `Pending payment verification. Present this receipt or your confirmation email when claiming your tickets.`

---

## STYLE

Dark Doom theme. Green is the accent color. No gold. No La Salle green (#006633). No red except the low-timer and expired states.

| Token | Value |
|---|---|
| Page background | #070A08 |
| Card | #0E1410, border #1F2A22, radius 16px |
| Primary green (buttons, accents) | #4CC16A, button text #05140A, hover #63CF7F |
| Light green text | #7BD892 |
| Deep green fill | #10251A |
| Green border | #2F6B40 |
| Text | #E6EBE7 |
| Muted text | #A7B0AA |
| Dim | #5E6E63 |
| Title silver | #DCE2DD |
| Inputs | bg #070A08, border #2A362E, focus border #4CC16A |
| Low timer / expired | bg #2A1414, border #7A2E2E, text #F08A8A |
| Disabled button | bg #26352B, text #6E7B72 |

- Fonts: Cinzel (title, showtimes, amount) and Poppins (everything else). Add a Google Fonts link for Cinzel 600/700 in `frontend/public/index.html` if not already loaded.
- Buttons and inputs at least 44px tall. Real `<button>`, `<input>`, `<label>` elements.
- Works at phone width: grids stack, seat map scrolls horizontally inside its box.
- No em dashes in any copy.