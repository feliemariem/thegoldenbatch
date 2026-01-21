# The Golden Batch - Development Roadmap

> Based on codebase analysis by F. Magbanua (January 2026)
> USLS-IS Batch 2003 Alumni Homecoming System

---

## 📊 Current State Summary

| Metric | Value |
|--------|-------|
| Frontend | React 18, 16 pages, 18 components |
| Backend | Express.js, 14 route modules (~4,500 lines) |
| Database | PostgreSQL, 18 tables, 30+ indexes |
| Data | 357 names in master list |

### What's Working Well ✅

**Security:**
- **Parameterized SQL queries** — Instead of building SQL strings with user input directly (which hackers can exploit), you use placeholders like `$1, $2`. This prevents SQL injection attacks where someone could type malicious code into a form field.
- **JWT-based stateless authentication** — Users get a signed token after login that proves who they are. The server doesn't need to store session data — it just verifies the token signature. This is secure, scalable, and industry-standard.
- **Granular permission system (16+ permissions)** — Instead of just "admin" or "not admin," you have specific permissions like `accounting_view`, `invites_add`, `masterlist_edit`. This follows the "principle of least privilege" — people only get access to what they need.

**Database Design:**
- **Foreign key constraints** — Your tables are properly linked (e.g., ledger entries connect to users). The database itself prevents orphaned or invalid data — you can't accidentally link a payment to a user that doesn't exist.
- **30+ database indexes** — Indexes make searches fast. Without them, the database scans every row. With them, it jumps directly to matching records. You've indexed the right columns for your queries.

**Architecture:**
- **Cloudinary/SendGrid integration** — You outsourced image hosting and email delivery to specialized services instead of building them yourself. Smart choice — these are hard problems, and these services handle scale, deliverability, and edge cases for you.
- **Helper functions (`toTitleCase()`, `checkPermission()`)** — You extracted repeated logic into reusable functions. This keeps code DRY (Don't Repeat Yourself) and makes bugs easier to fix in one place.

---

## 🚀 Quick Wins (Do Anytime)

Low effort, minimal risk. Can be done between other tasks.

### QW-1: Remove Duplicate Schema Definition
- [ ] Delete duplicate `admins` table definition at line 222 in `schema.sql`
- **Why:** Duplicate table definition could cause confusion or errors
- **Effort:** 5 minutes

### QW-2: Add `.env.example` File
- [ ] Create `.env.example` documenting all required environment variables
- **Why:** Makes setup easier for future collaborators or fresh deployments
- **Effort:** 15 minutes

### QW-3: Extract Magic Numbers to Constants
- [ ] Create `backend/config/constants.js`
- [ ] Move hardcoded values:
  ```js
  export const AMOUNT_DUE = 25000;
  export const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
  export const JWT_EXPIRY_DEFAULT = '7d';
  export const JWT_EXPIRY_REMEMBER = '30d';
  ```
- [ ] Update references in `users.js`, `AuthContext.js`, and auth routes
- **Why:** Single source of truth; easier to update values later
- **Effort:** 30 minutes

### QW-4: Clean Up Console Logs
- [ ] Remove or gate `console.log` statements in `auth.js` and other production code
- [ ] Consider using `if (process.env.NODE_ENV === 'development')` wrapper
- **Why:** Cleaner production logs, minor performance improvement
- **Effort:** 30 minutes

---

## 🛡️ High Priority (Post-Demo)

Important for security and scalability. Do before heavy usage.

### HP-1: Add Rate Limiting
- [ ] Install `express-rate-limit`: `npm install express-rate-limit`
- [ ] Apply to auth routes (`/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`)
- [ ] Suggested limits: 5 attempts per 15 minutes for login
- **Why:** Prevents brute force password attacks
- **Effort:** 1-2 hours
- **Example:**
  ```js
  const rateLimit = require('express-rate-limit');
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many attempts, please try again later'
  });
  app.use('/api/auth/login', authLimiter);
  ```

### HP-2: Add Pagination to List Endpoints
- [ ] Backend: Add `?page=1&limit=50` support to:
  - [ ] `/api/master-list`
  - [ ] `/api/ledger`
  - [ ] `/api/users` (registered)
  - [ ] `/api/invites`
- [ ] Frontend: Implement hybrid pagination (infinite scroll + jump to page)
- **Why:** 357 names now; will grow. Prevents slow loads and large payloads.
- **Effort:** 4-6 hours (backend), 4-6 hours (frontend)
- **Backend example:**
  ```js
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  // SQL: SELECT * FROM table LIMIT ${limit} OFFSET ${offset}
  ```

### HP-3: Standardize Error Handling
- [ ] Create `backend/middleware/errorHandler.js`
- [ ] Wrap all routes with async error catching
- [ ] Return consistent error response format:
  ```js
  { error: true, message: "Description", code: "ERROR_CODE" }
  ```
- **Why:** Inconsistent error handling makes debugging harder; some routes check permissions at different points
- **Effort:** 3-4 hours

---

## 🔧 Medium Priority (Post-Demo)

Code quality and maintainability improvements.

### MP-1: Split AdminDashboard.js (~1,600 lines)
Currently, AdminDashboard.js handles everything for Registry mode inline, while other modes already use separate components.

**Already extracted (no action needed):**
- `AccountingDashboard.js` — Accounting mode
- `AnnouncementComposer.js` — Announce mode
- `MeetingMinutes.js` — Meetings mode
- `AdminMessages.js` — Messages mode
- `PermissionsManager.js` — Permissions mode
- `SystemTest.js` — System Test mode

**Still embedded in AdminDashboard.js (needs extraction):**
- [ ] Create `AdminDashboard/` folder structure:
  ```
  AdminDashboard/
  ├── index.js              (mode switching, ~200 lines)
  ├── RegistryMode/
  │   ├── index.js          (tab switching, stats display)
  │   ├── InvitesTab.js     (invite CRUD, CSV upload, table)
  │   ├── RegisteredTab.js  (registered users table, filters)
  │   └── MasterListTab.js  (master list table, filters, stats)
  ```
- [ ] Move all Registry-related state to RegistryMode/index.js
- [ ] Move invite handlers (create, update, delete, CSV upload, link/unlink) to InvitesTab.js
- [ ] Move registered user filtering and display to RegisteredTab.js
- [ ] Move master list handlers and filtering to MasterListTab.js
- [ ] Keep shared state (permissions, user, token) in main index.js and pass as props

**Why:** 
- AdminDashboard.js is currently ~1,600 lines — hard to navigate and debug
- Registry mode alone has ~1,000 lines of JSX and handlers
- Splitting matches the pattern already used for other modes

**Effort:** 4-6 hours

**Result:** AdminDashboard/index.js drops to ~200 lines, each tab file is ~200-400 lines

### MP-2: Implement Structured Logging
- [ ] Install Winston or Pino: `npm install winston`
- [ ] Replace `console.log` with logger
- [ ] Add request IDs for tracing
- [ ] Configure log levels (error, warn, info, debug)
- **Why:** Better debugging in production; can filter by severity
- **Effort:** 2-3 hours

---

## 🧪 Testing (Post-Demo)

No tests currently. Add after features stabilize.

### T-1: Setup Testing Infrastructure
- [ ] Install Jest and React Testing Library
  ```bash
  npm install --save-dev jest @testing-library/react @testing-library/jest-dom
  ```
- [ ] Configure Jest in `package.json` or `jest.config.js`
- [ ] Add test scripts: `"test": "jest"`, `"test:watch": "jest --watch"`
- **Effort:** 1-2 hours

### T-2: Auth Logic Tests (Start Here)
- [ ] Test login flow (valid/invalid credentials)
- [ ] Test registration flow (valid invite, used invite, expired invite)
- [ ] Test JWT validation and expiry
- [ ] Test password reset flow
- **Why:** Auth is critical; if it breaks, everything breaks
- **Effort:** 4-6 hours

### T-3: Permission Tests
- [ ] Test `checkPermission()` helper
- [ ] Test admin middleware
- [ ] Test role-based access to routes
- **Effort:** 2-3 hours

### T-4: API Endpoint Tests
- [ ] Test CRUD operations for major entities (users, events, ledger)
- [ ] Test edge cases (missing fields, invalid IDs)
- **Effort:** 6-8 hours

---

## 📋 Future Considerations (Backlog)

Nice to have, but not urgent.

### Targeted Code Reviews (Run Later)

Use these prompts with Claude Code after completing roadmap items for fresh feedback:

**API Route Naming & REST Conventions**
```
Review my backend route files in /backend/routes/. Are my endpoints following RESTful conventions? Flag any inconsistent naming patterns (e.g., /get-user vs /users/:id) and suggest improvements.
```

**Error Handling Consistency**
```
Review error handling across my backend route files. Are errors handled consistently? Look for: missing try/catch blocks, inconsistent error response formats, places where errors might fail silently. Show specific examples.
```

**Frontend State Management**
```
Review my React context files and how state flows through the app. Are there any prop drilling issues, redundant state, or places where state management could be simplified?
```

**CSS Organization**
```
Review my CSS files. Are there duplicate styles, inconsistent naming conventions, or opportunities to consolidate? How could I better organize the stylesheets?
```

### F-1: Consider Query Builder
- Routes like `ledger.js` build SQL strings manually (lines 22-78)
- Consider Knex.js for cleaner, safer query building
- **Trade-off:** Learning curve, adds dependency

### F-2: Database Migrations
- Currently using raw `schema.sql`
- Consider migration tool (Knex migrations, node-pg-migrate)
- **Trade-off:** More structure, but adds complexity

### F-3: API Documentation
- Document endpoints with OpenAPI/Swagger
- Helps future developers understand the API

---

## 📅 Suggested Timeline

| Phase | Focus | Items |
|-------|-------|-------|
| **Pre-Demo** | Stability | Just bug fixes, no refactoring |
| **Week 1 Post-Demo** | Quick Wins | QW-1, QW-2, QW-3, QW-4 |
| **Week 2-3 Post-Demo** | Security | HP-1 (Rate Limiting), HP-3 (Error Handling) |
| **Week 4-5 Post-Demo** | Scalability | HP-2 (Pagination) |
| **Ongoing** | Code Quality | MP-1, MP-2, Testing |

---

## ✅ Completed

(Move items here as you finish them)

- [ ] _Nothing yet_

---

*Last updated: January 2026*
