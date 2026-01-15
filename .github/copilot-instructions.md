# Copilot instructions for thegoldenbatch

Short, actionable notes to help an AI contributor be productive in this repository.

1) Big picture
- This is a two-tier web app: an Express backend (backend/) and a Create React app frontend (frontend/).
- Backend exposes a REST API rooted at /api; routes live in `backend/routes/*.js` and are mounted in `backend/server.js`.
- Frontend calls the API on http://localhost:5000 (see `frontend/package.json` proxy). Frontend entry is `frontend/src/index.js` and top-level routes/pages are under `frontend/src/pages`.

2) How to run locally (developer workflow)
- Backend: from `backend/` run `npm install` then `npm run dev` (uses nodemon) or `npm start` to run once. Environment variables required include `DATABASE_URL`, `JWT_SECRET`, `SENDGRID_API_KEY`, Cloudinary keys, and `FROM_EMAIL`.
- Create initial admin user: run `node setup-admin.js <email> <password>` from `backend/` (script is `backend/setup-admin.js`).
- Frontend: from `frontend/` run `npm install` then `npm start`. The app expects the backend at `http://localhost:5000` (proxy set in `frontend/package.json`).

3) Auth & sessions (important conventions)
- Backend uses JWTs signed with `process.env.JWT_SECRET`. The auth middleware is `backend/middleware/auth.js` and exports `authenticateToken` and `authenticateAdmin`.
- Frontend stores JWT in `localStorage` under `token` and keeps a `lastActivity` timestamp to enforce a 24-hour session timeout (`frontend/src/context/AuthContext.js`).
- Admin users are detected by a boolean `isAdmin` in the JWT payload. Many frontend components check `payload.isAdmin` and redirect if unauthorized (see `frontend/src/pages/Login.js` and `frontend/src/pages/AdminDashboard.js`).

4) API patterns and examples
- Routes follow REST conventions and are grouped by feature: `invites`, `master-list`, `donations`, `permissions`, `ledger`, `meetings`, and `announcements` (see `backend/routes/`).
- All protected API calls expect the header: `Authorization: Bearer <token>`.
- Bulk CSV uploads are implemented client-side in `AdminDashboard.js` (parsing CSV text) and posted to endpoints like `/api/invites/bulk` and `/api/master-list/bulk`.

5) External integrations
- Email: SendGrid via `backend/utils/email.js`. Use `SENDGRID_API_KEY` and `FROM_EMAIL` env vars.
- File uploads: Cloudinary via `backend/utils/cloudinary.js`. The Cloudinary helper uploads buffers (multer memory storage) to folders under `usls-batch-2003/`.
- Database: PostgreSQL accessed through `backend/db.js` using `pg` and `process.env.DATABASE_URL`.

6) Key files to look at for behavior examples
- `backend/server.js` — route registration and health check (`/api/health`).
- `backend/middleware/auth.js` — JWT verification and admin gating.
- `backend/setup-admin.js` — CLI helper to seed an admin user.
- `backend/utils/email.js` and `backend/utils/cloudinary.js` — concrete integrations with SendGrid and Cloudinary.
- `frontend/src/context/AuthContext.js` — token handling, session timeout, token decoding, and how profile loading works.
- `frontend/src/pages/AdminDashboard.js` — example of admin UI patterns: tabs persisted in localStorage, CSV parsing logic, and many `fetch()` calls using the Bearer token header.

7) Project-specific conventions
- Tokens are treated as source-of-truth; the frontend decodes the JWT client-side for quick checks (e.g. `isAdmin`) and otherwise fetches `/api/me` using the token to populate `user`.
- CSV parsing is done in the browser; expect many endpoints to accept arrays (bulk operations) rather than file uploads on the backend.
- Admin UI persists UI state in `localStorage` (e.g. `adminActiveTab`). When updating UI state, check for localStorage usage.

8) Tests and linting
- There are no automated tests or lint configs in the repository. Keep changes small and validated by running the local server and the frontend dev server.

9) Safe edit practices for AI agents
- Preserve existing REST routes and route names; add new API routes under `backend/routes/` and register them in `backend/server.js`.
- When touching auth logic, update both `backend/middleware/auth.js` and `frontend/src/context/AuthContext.js` to keep behavior consistent.
- For changes touching environment variables, update README.md and mention required vars in the server start instructions.

10) Quick examples to copy when implementing features
- Fetch with auth header (frontend):

  fetch('http://localhost:5000/api/permissions/me', { headers: { Authorization: `Bearer ${token}` } })

- Server route mount (backend/server.js):

  const inviteRoutes = require('./routes/invites');
  app.use('/api/invites', inviteRoutes);

- Creating admin from CLI (backend root):

  node setup-admin.js admin@example.com strongpassword

11) When you're unsure
- Search `backend/routes` for a feature before adding a new endpoint. Follow existing parameter names and response shapes.
- Prefer small, incremental changes and run the backend (`npm run dev`) and frontend (`npm start`) to smoke-test.

If any section is unclear or you'd like examples expanded (for example, database schema snippets or common SQL queries), tell me which area and I'll extend this file.
