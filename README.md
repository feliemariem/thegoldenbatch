# The Golden Batch

**USLS-IS Batch 2003 Alumni Homecoming System**

A web-based platform for organizing and managing the 25th reunion of USLS-IS High School Batch 2003. This system supports the organizing committee in coordinating alumni outreach, event planning, fund management, and communication.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, React Router 6 |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| File Storage | Cloudinary |
| Email Service | SendGrid |
| Authentication | JWT with bcrypt |

## Key Features

### Alumni Management
- **Invite-Only Registration** — Alumni can only register with a valid invite linked to the master list
- **Alumni Directory** — Searchable directory of registered batchmates
- **Profile Management** — Alumni can update their contact information and profile photos

### Event Coordination
- **RSVP Tracking** — Track attendance for the main reunion and pre-reunion gatherings
- **Event Management** — Create and publish events with date, time, and location details
- **Volunteer Sign-ups** — Alumni can express interest in helping with specific committees

### Financial Management
- **Fund Ledger** — Track all deposits and withdrawals with receipt uploads
- **Donation Tracking** — Link contributions to specific alumni from the master list
- **Payment Verification** — Admins can verify and categorize transactions

### Communication
- **Announcements** — Broadcast messages to all alumni or specific audiences via email
- **Internal Messaging** — Direct messaging between alumni and the organizing committee
- **Inbox System** — Centralized inbox for committee members to manage inquiries

### Committee Tools
- **Admin Dashboard** — Central hub for committee members with role-based access
- **Permissions System** — Granular control over what each admin can view and manage
- **Meeting Minutes** — Document meeting notes with attachments and action items
- **Task Management** — Assign and track action items from committee meetings

## Project Structure

```
thegoldenbatch/
├── frontend/           # React single-page application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page-level components
│   │   └── context/    # React context providers
│   └── public/         # Static assets
│
├── backend/            # Express API server
│   ├── routes/         # API route handlers
│   ├── middleware/     # Authentication middleware
│   ├── utils/          # Cloudinary, email utilities
│   └── schema.sql      # Database schema
│
└── public/             # Shared public assets
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Cloudinary account
- SendGrid account

### Environment Setup

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
SENDGRID_API_KEY=...
```

**Frontend** (`frontend/.env`):
```
REACT_APP_API_URL=http://localhost:5000
```

### Installation

```bash
# Install backend dependencies
cd backend
npm install

# Initialize database
psql $DATABASE_URL < schema.sql

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

```bash
# Start backend (from backend/)
npm run dev

# Start frontend (from frontend/)
npm start
```

The frontend runs on `http://localhost:3000` and proxies API requests to the backend on port 5000.

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features and development priorities.

## License

Private project for USLS-IS Batch 2003 organizing committee use only.
