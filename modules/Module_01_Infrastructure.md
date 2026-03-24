# Module 1: Infrastructure & Environment Setup

## Goal

Establish the complete development and deployment foundation for the Elevate Pilates LMS. This module delivers working staging and production environments, a CI/CD pipeline, Firebase project configuration, the Express API scaffold, and the React frontend scaffold — all wired together and ready for feature development in subsequent modules.

## Dependencies

None — this is the foundation module.

## Depended on by

All other modules (2–8).

---

## Detailed Features

### 1.1 Firebase Project Configuration

- Create a single Firebase project.
- Enable the following Firebase services:
  - **Firebase Auth** (email/password provider enabled; other providers disabled).
  - **Firestore** in production mode with security rules denying unauthenticated access by default.
  - **Firebase Storage** with security rules restricting uploads to authenticated admin users and reads to authenticated users.
- Generate and store Firebase service account keys securely (never committed to repo).
- Configure Firebase Admin SDK on the Express server for server-side operations.

### 1.2 Express.js API Server Scaffold

- Node.js + Express.js project initialized with the following structure:

```
server/
├── src/
│   ├── config/          # Firebase admin init, env config
│   ├── middleware/       # Auth middleware, error handler, rate limiter
│   ├── routes/          # Route definitions (index, health)
│   ├── controllers/     # Route handlers
│   ├── services/        # Business logic layer
│   ├── utils/           # Helpers, constants
│   └── index.js         # Express app entry point
├── .env.example         # Template for environment variables
├── .env.staging         # Staging config (git-ignored)
├── .env.production      # Production config (git-ignored)
├── package.json
└── README.md
```

- Environment-based configuration loading (`NODE_ENV` = `development`, `staging`, `production`).
- Centralized error handling middleware.
- Request logging (morgan or equivalent).
- CORS configured for the React frontend origin.
- Helmet.js for HTTP security headers.
- Rate limiting middleware on API routes.

### 1.3 React Frontend Scaffold

- React app initialized (Vite recommended for speed) with the following structure:

```
client/
├── public/
├── src/
│   ├── assets/          # Static assets, images
│   ├── components/      # Shared/reusable UI components
│   │   └── layout/      # AppShell, Sidebar, Header, Footer
│   ├── config/          # Firebase client init, env config
│   ├── contexts/        # React contexts (auth, theme)
│   ├── hooks/           # Custom hooks
│   ├── pages/           # Page-level components
│   ├── routes/          # Route definitions, protected route wrapper
│   ├── services/        # API client, Firebase service wrappers
│   ├── utils/           # Helpers, constants
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── .env.staging
├── .env.production
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

- Environment-based Firebase client SDK configuration.
- React Router v6 setup with placeholder routes (`/`, `/login`, `/dashboard`, `/admin`, `/404`).
- Base layout shell (header, sidebar placeholder, main content area, footer).
- Global error boundary component.
- Axios or fetch wrapper for API calls to the Express backend with auth token injection.
- Responsive CSS foundation (Tailwind CSS recommended).

### 1.4 Staging and Production Environments

- **Staging**: separate Firebase project (or emulator suite for local dev) + deployed API + deployed frontend.
- **Production**: separate Firebase project + deployed API + deployed frontend.
- Environment variables are isolated per environment and never shared across them.
- Domain and SSL configured for production (HTTPS enforced).
- Staging accessible via a separate subdomain or URL.

### 1.5 CI/CD Pipeline

- Pipeline configured using GitHub Actions (or equivalent) with the following stages:
  - **Lint & type check** on every push/PR.
  - **Run tests** (unit tests) on every push/PR.
  - **Build** frontend and backend artifacts.
  - **Deploy to staging** on merge to `develop` (or staging branch).
  - **Deploy to production** on merge to `main` (or tagged release).
- Deployment steps include:
  - Build React app and upload to hosting (Firebase Hosting or equivalent static host).
  - Deploy Express API to hosting platform (e.g., Cloud Run, Railway, Render, or Firebase Cloud Functions as a container).
  - Deploy Firestore security rules and Storage security rules.
- Secrets managed via CI/CD environment variables (not hardcoded).

### 1.6 Security Baseline

- All API routes require HTTPS in staging and production.
- Firebase service account keys and secrets stored as environment variables, never in source control.
- `.gitignore` configured to exclude `.env.*`, `serviceAccountKey.json`, `node_modules/`, `dist/`, `build/`.
- Helmet.js security headers on all Express responses.
- CORS restricted to known frontend origins.
- Rate limiting on public-facing API endpoints.

### 1.7 Backup and Recovery

- Firestore automated daily backups enabled via Firebase scheduled exports (Cloud Scheduler + Cloud Function or manual cron).
- Firebase Storage has built-in redundancy (no custom backup required for MVP).
- Documented recovery procedure in technical runbook.

### 1.8 Technical Runbook

- Document covering:
  - How to set up local development environment.
  - How to deploy to staging and production.
  - How to rotate Firebase service account keys.
  - How to access logs and monitor errors.
  - How to restore Firestore from backup.
  - Environment variable reference table.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Node.js version | 18 LTS or later |
| React version | 18+ (via Vite) |
| CSS framework | Tailwind CSS 3+ |
| Firebase SDK | Firebase Admin SDK (server), Firebase JS SDK v9+ modular (client) |
| Package manager | npm or yarn (consistent across team) |
| Linting | ESLint + Prettier (shared config for client and server) |
| Testing | Jest (server), Vitest or Jest (client) |
| Source control | Git, hosted on GitHub |

---

## Database Schema (Firestore)

Module 1 sets up the Firestore instance and defines one system-level collection. Feature collections are defined in their respective modules.

### Collection: `systemConfig`

Stores platform-wide configuration. Single document.

```
systemConfig/
  └── appSettings (document)
        ├── platformName: string          // "Elevate Pilates LMS"
        ├── maintenanceMode: boolean      // false
        ├── passwordPolicy: map
        │     ├── minLength: number       // 8
        │     ├── requireUppercase: boolean // true
        │     ├── requireLowercase: boolean // true
        │     ├── requireNumber: boolean    // true
        │     └── requireSymbol: boolean    // true
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Firestore Security Rules (base)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Default: deny all
    match /{document=**} {
      allow read, write: if false;
    }

    // System config: admin read only, no client writes
    match /systemConfig/{doc} {
      allow read: if request.auth != null;
      allow write: if false; // managed via Admin SDK on server
    }
  }
}
```

### Firebase Storage Security Rules (base)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Default: deny all
    match /{allPaths=**} {
      allow read, write: if false;
    }

    // Training videos: authenticated users can read
    match /videos/{videoFile} {
      allow read: if request.auth != null;
      allow write: if false; // uploads handled via Admin SDK on server
    }
  }
}
```

---

## API Endpoints

Module 1 exposes only health and config endpoints. All feature endpoints are defined in their respective modules.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Returns server status, uptime, and environment name. Used by CI/CD and monitoring. |
| `GET` | `/api/config/public` | None | Returns non-sensitive public config (platform name, password policy rules) for the frontend. |
| `GET` | `/api/config/system` | Admin | Returns full system config for admin dashboard. |

### Response Formats

**`GET /api/health`**
```json
{
  "status": "ok",
  "environment": "production",
  "uptime": 84523,
  "timestamp": "2026-03-19T12:00:00Z"
}
```

**`GET /api/config/public`**
```json
{
  "platformName": "Elevate Pilates LMS",
  "passwordPolicy": {
    "minLength": 8,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumber": true,
    "requireSymbol": true
  }
}
```

---

## UI Components

Module 1 delivers the application shell and shared layout components. No feature-specific UI.

| Component | Location | Purpose |
|---|---|---|
| `AppShell` | `components/layout/AppShell.jsx` | Top-level layout wrapper: header + sidebar + content + footer |
| `Header` | `components/layout/Header.jsx` | Platform logo, user name (when logged in), logout action |
| `Sidebar` | `components/layout/Sidebar.jsx` | Navigation links (role-aware, populated in Module 2) |
| `Footer` | `components/layout/Footer.jsx` | Copyright, version number |
| `ErrorBoundary` | `components/ErrorBoundary.jsx` | Catches React render errors, shows fallback UI |
| `LoadingSpinner` | `components/LoadingSpinner.jsx` | Shared loading indicator |
| `NotFoundPage` | `pages/NotFoundPage.jsx` | 404 page |
| `MaintenancePage` | `pages/MaintenancePage.jsx` | Shown when `maintenanceMode` is true |
| `ProtectedRoute` | `routes/ProtectedRoute.jsx` | Route wrapper that checks auth state (wired in Module 2) |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Local development environment starts with a single command per service (`npm run dev` for client and server). | Manual check |
| 2 | Express API responds to `GET /api/health` with `200 OK` and correct payload. | Automated test |
| 3 | React app loads in browser, renders AppShell with header/sidebar/footer. | Manual check |
| 4 | Firebase Auth, Firestore, and Storage are initialized and accessible from the Express server via Admin SDK. | Automated test |
| 5 | Firebase client SDK connects from React app (auth state listener fires). | Manual check |
| 6 | Environment variables load correctly per environment (dev, staging, production). | Automated test |
| 7 | CI/CD pipeline passes lint, test, and build stages on a clean push. | Pipeline run |
| 8 | Staging deployment is accessible at staging URL with HTTPS. | Manual check |
| 9 | Production deployment is accessible at production URL with HTTPS. | Manual check |
| 10 | Firestore security rules deny unauthenticated read/write by default. | Security rules test |
| 11 | `.env` files and service account keys are excluded from version control. | `.gitignore` audit |
| 12 | Technical runbook document exists and covers all listed procedures. | Document review |

---

## Integration Points with Other Modules

| Target Module | What this module provides |
|---|---|
| Module 2 (Auth) | Firebase Auth initialized, `ProtectedRoute` shell ready, auth middleware scaffold on Express |
| Module 3 (CMS) | Firestore connection ready, Express route structure ready, React Router scaffold ready |
| Module 4 (Content) | Firebase Storage configured and accessible, React layout shell ready |
| Module 5 (Quiz) | Firestore and Express ready for quiz collections and endpoints |
| Module 6 (Progress) | Firestore ready for progress tracking collections |
| Module 7 (Dashboard) | Express + React scaffold ready for admin views |
| Module 8 (Reminders) | Server environment ready for scheduled tasks / cron triggers |
