# Elevate Pilates

A Pilates training LMS that delivers structured courses, quizzes (assessments), and progress tracking for trainees. Admins manage content, users, enrollments, reminders, and reports through a dedicated dashboard.

## Tech Stack

| Layer | Tech |
|-------|------|
| Monorepo | npm workspaces (`client`, `server`), Node ≥ 18 |
| Frontend | React 19, Vite 6, React Router 7, Tailwind CSS 3 |
| Backend | Express 4, Firebase Admin SDK (Auth + Firestore + Cloud Storage) |
| Auth | Firebase Authentication (email/password), JWT ID tokens |
| Rich text | React Quill (editor), DOMPurify / sanitize-html (sanitization) |
| Drag & drop | @hello-pangea/dnd |
| Scheduling | node-cron (automated reminders) |
| Reports | json2csv (CSV exports) |
| Testing | Vitest + Testing Library + happy-dom (client), Node test runner + supertest (server) |

## Project Structure

```
├── package.json            # workspace root
├── client/                 # React SPA
│   ├── src/
│   │   ├── components/     # shared UI components
│   │   ├── contexts/       # AuthContext, ThemeContext, ToastContext
│   │   ├── pages/          # route-level page components
│   │   ├── routes/         # AppRoutes definition
│   │   ├── services/       # Axios API client
│   │   └── config/         # Firebase client config
│   ├── vite.config.js      # dev proxy /api → localhost:3001
│   ├── tailwind.config.js
│   └── vercel.json         # SPA rewrite for Vercel deploys
└── server/
    ├── src/
    │   ├── routes/         # Express route handlers
    │   ├── middleware/      # auth, rate limiting
    │   ├── services/       # Cloud Storage, reminders
    │   ├── config/         # env loader, Firebase Admin init
    │   └── utils/          # Firestore helpers
    ├── tests/
    ├── scripts/            # set-admin-role.mjs
    └── storage-cors.json   # example GCS CORS config
```

## Prerequisites

- **Node.js ≥ 18**
- A **Firebase project** with Authentication (email/password), Firestore, and Cloud Storage enabled
- A **service account JSON** file from Firebase Console → Project Settings → Service Accounts

## Getting Started

### 1. Install dependencies

From the repo root:

```bash
npm install
```

This installs both `client` and `server` workspaces.

### 2. Configure environment variables

Copy the example files and fill in your values:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

**`client/.env`**

| Variable | Notes |
|----------|-------|
| `VITE_API_BASE_URL` | Leave empty in dev (Vite proxies `/api` to the server) |
| `VITE_FIREBASE_API_KEY` | From Firebase Console → Project Settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_MAINTENANCE_MODE` | `"true"` to show maintenance page; default `false` |

**`server/.env`**

| Variable | Notes |
|----------|-------|
| `NODE_ENV` | `development` / `staging` / `production` |
| `PORT` | Server port (default `3001`) |
| `CLIENT_ORIGIN` | Browser origin for CORS, e.g. `http://localhost:5173` |
| `FRONTEND_URL` | Used in invite emails; defaults to `CLIENT_ORIGIN` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to your service account JSON (never commit this) |
| `FIREBASE_STORAGE_BUCKET` | Override if your bucket isn't the default `appspot.com` one |
| `FIREBASE_WEB_API_KEY` | Required for password change (Identity Toolkit REST call) |
| `MAINTENANCE_MODE` | Server-side maintenance flag |
| `INVITE_EXPIRY_DAYS` | Optional, default `7` |
| `MAX_VIDEO_UPLOAD_BYTES` | Optional, default `524288000` (500 MB) |
| `REMINDER_CRON` | Cron expression for the reminder scheduler |
| `INTERNAL_API_KEY` | Shared secret for internal reminder endpoints |
| `AUTH_DEBUG` | Set to `"true"` for verbose auth middleware logging |

### 3. Cloud Storage CORS

If admins will upload videos, the GCS bucket needs CORS rules allowing `PUT` from your app origins:

```bash
gsutil cors set server/storage-cors.json gs://YOUR_BUCKET_NAME
```

Edit `server/storage-cors.json` to include your actual origins before running this.

### 4. Run in development

Open two terminals (or use the workspace scripts):

```bash
# Terminal 1 — API server (watches for changes)
npm run dev:server

# Terminal 2 — Vite dev server (hot reload)
npm run dev:client
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3001`
- The Vite dev server proxies `/api/*` requests to the Express server automatically.

### 5. Promote a user to admin

After creating a user through the app (or Firebase Console), run:

```bash
npm run set-admin --workspace=server -- <uid-or-email>
```

This sets the `admin` role in Firestore and on the user's custom claims.

## Scripts

| Command | Scope | Description |
|---------|-------|-------------|
| `npm run dev:client` | root | Start the Vite dev server |
| `npm run dev:server` | root | Start the Express server with `--watch` |
| `npm run build` | root | Production build of the client |
| `npm test` | root | Run server tests, then client tests |
| `npm run lint` | client or server | ESLint |
| `npm run preview` | client | Preview the production build locally |
| `npm run set-admin` | server | Promote a user to admin role |

## API Overview

All server routes are mounted under `/api`. Auth-protected routes expect a `Bearer <Firebase ID token>` header.

| Prefix | Purpose |
|--------|---------|
| `/api/health` | Health check |
| `/api/config` | Public/full app config |
| `/api/auth` | Token verification, role sync |
| `/api/invites` | Invite creation and acceptance |
| `/api/users` | Admin user management |
| `/api/profile` | Profile read/update, password change |
| `/api/my` | Trainee: enrollments, progress, quiz attempts |
| `/api/quizzes` | Quiz/assessment CRUD |
| `/api/admin/progress` | Admin progress views |
| `/api/admin/dashboard` | Admin dashboard stats |
| `/api/admin/reminders` | Reminder settings and logs |
| CMS routes (`/api/courses`, `/api/modules`, `/api/lessons`) | Course content CRUD (admin) |
| `/api/admin/reports/*` | Overdue, assessment, and completion CSV exports |

## Testing

```bash
# All tests
npm test

# Client only
npm test --workspace=client

# Server only
npm test --workspace=server
```

Client tests use **Vitest** with **happy-dom** and **Testing Library**. Server tests use Node's built-in test runner with **supertest**.

## Deployment Notes

- **Client**: configured for Vercel (`vercel.json` SPA rewrite) and Netlify (`public/_redirects`). Set `VITE_API_BASE_URL` to your deployed API origin.
- **Server**: deploy as a standard Node process. Ensure the Firebase service account JSON is available at the configured path and all `server/.env` variables are set in your hosting environment.
- Environment-specific overrides: the server loads `.env.staging` or `.env.production` automatically when `NODE_ENV` matches.

## Key Architectural Decisions

- **Firestore as sole datastore** — no SQL database; all entities (users, courses, modules, lessons, enrollments, progress, quizzes, reminders) are Firestore collections.
- **Signed URL uploads** — large video files are uploaded directly from the browser to Cloud Storage via signed URLs generated by the server, avoiding the need to proxy file data through Express.
- **Role resolution** — user roles are stored in Firestore (`users` collection) and optionally mirrored as Firebase custom claims. The auth middleware checks both, with Firestore as the source of truth.
- **Maintenance mode** — toggleable on both client (`VITE_MAINTENANCE_MODE`) and server (`MAINTENANCE_MODE`) independently.
