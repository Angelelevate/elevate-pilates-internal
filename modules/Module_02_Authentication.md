# Module 2: Authentication & Role-Based Access

## Goal

Implement secure authentication and role-based access control for the Elevate Pilates LMS using Firebase Auth. This module delivers the invite-based trainee onboarding flow, admin and trainee login, role enforcement on both client and server, password policy enforcement, session handling, and account management — providing the identity layer that every other module depends on.

## Dependencies

- **Module 1** — Firebase Auth initialized, Express middleware scaffold, React router and `ProtectedRoute` shell, Firestore connection.

## Depended on by

- Modules 3–8 (all feature modules require authenticated users and role checks).

---

## Detailed Features

### 2.1 Role Model

Two roles in MVP:

| Role | Firebase custom claim | Access scope |
|---|---|---|
| `admin` | `{ role: "admin" }` | Full platform access: CMS, reporting, user management, settings |
| `trainee` | `{ role: "trainee" }` | Learner access only: assigned course, own progress, own profile |

- Roles are stored as **Firebase Auth custom claims** set via the Admin SDK on the server.
- The React frontend reads the role from the decoded ID token to control UI visibility.
- The Express backend verifies the role from the ID token on every protected request.

### 2.2 Admin Login

- Admin accounts are pre-created manually (via Firebase Console or a seed script) during initial setup.
- Admin logs in with email + password on the standard login page.
- On successful login, the frontend reads the `admin` custom claim and redirects to the admin dashboard.
- Failed login shows clear error messaging (invalid credentials, account disabled).

### 2.3 Invite-Based Trainee Onboarding

This is the core onboarding flow. Trainees do not self-register.

**Step 1 — Admin sends invite**
- Admin enters trainee email (and optional name) in the admin panel.
- Server creates an invite record in Firestore with status `pending` and generates a secure invite token (UUID v4 or equivalent).
- Server sends an invitation email to the trainee with a link: `{frontendUrl}/invite/{inviteToken}`.
- No Firebase Auth user is created at this point.

**Step 2 — Trainee accepts invite**
- Trainee opens the invite link.
- Frontend validates the invite token against Firestore (must be `pending` and not expired).
- If valid, trainee sees the account setup form.

**Step 3 — Trainee completes onboarding**
- Trainee enters: first name, last name, phone (optional), and sets a password.
- Password is validated against the password policy (see 2.5).
- On submit:
  1. Server creates the Firebase Auth user with email + password.
  2. Server sets the `trainee` custom claim on the new user.
  3. Server creates a `users` document in Firestore with profile data and links to the Firebase Auth UID.
  4. Server updates the invite record status to `accepted`.
  5. Server assigns the active course to the trainee (creates an enrollment record — defined in Module 3).
- Trainee is automatically logged in and redirected to their course dashboard.

**Step 4 — Invite expiry**
- Invites expire after **7 days** by default (configurable in `systemConfig`).
- Expired invites show a clear message and prompt the trainee to contact their admin.
- Admin can resend invites from the user management panel.

### 2.4 Session Handling

- Firebase Auth handles token lifecycle (ID tokens + refresh tokens).
- Frontend stores the Firebase Auth session (IndexedDB via Firebase SDK persistence).
- On every API request, the frontend attaches the ID token in the `Authorization: Bearer {token}` header.
- Express auth middleware:
  1. Extracts the Bearer token.
  2. Verifies it via `admin.auth().verifyIdToken(token)`.
  3. Attaches the decoded user (UID, email, role) to `req.user`.
  4. Rejects with `401` if token is missing/invalid/expired.
- Session timeout: relies on Firebase Auth default token lifecycle (ID token expires after 1 hour, auto-refreshed by client SDK).

### 2.5 Password Policy

Enforced during account creation and password changes. Rules are read from `systemConfig.appSettings.passwordPolicy` in Firestore.

| Rule | Default |
|---|---|
| Minimum length | 8 characters |
| Require uppercase letter | Yes |
| Require lowercase letter | Yes |
| Require number | Yes |
| Require symbol | Yes |

- Password validation runs on both the frontend (real-time feedback) and the server (final enforcement before creating the Firebase Auth user).
- Firebase Auth's own password strength rules are left at default (6 chars); the app-level policy is stricter and enforced by the server.

### 2.6 Password Reset

- User clicks "Forgot password" on the login page.
- Frontend calls `sendPasswordResetEmail()` via Firebase Auth client SDK.
- Firebase sends a reset email with a secure link.
- User sets a new password (Firebase-hosted reset page or custom page using `confirmPasswordReset()`).
- New password must meet the password policy.

### 2.7 Account Management (Admin)

- Admin can view all trainee accounts in a user management table.
- Admin can:
  - Resend an expired or pending invite.
  - Disable a trainee account (sets Firebase Auth `disabled` flag via Admin SDK).
  - Re-enable a disabled account.
- Admin cannot delete accounts in MVP (soft disable only).
- Admin can view invite status: `pending`, `accepted`, `expired`.

### 2.8 Role-Based Route Protection

**Express (server-side):**
- `requireAuth` middleware — verifies token, attaches `req.user`. Returns `401` if unauthenticated.
- `requireRole(role)` middleware — checks `req.user.role` against the required role. Returns `403` if unauthorized.
- All admin endpoints use `requireAuth` + `requireRole('admin')`.
- All trainee endpoints use `requireAuth` + `requireRole('trainee')`.
- Some endpoints (e.g., profile) accept both roles with `requireAuth` only.

**React (client-side):**
- `ProtectedRoute` component reads auth state and role from context.
- Redirects unauthenticated users to `/login`.
- Redirects users to their role-appropriate dashboard if they access a route outside their role.
- `AuthContext` provides: `user`, `role`, `loading`, `login()`, `logout()`.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Firebase Auth provider | Email/password only (no social login in MVP) |
| Custom claims | Set via Firebase Admin SDK on the Express server |
| Token verification | `admin.auth().verifyIdToken()` on every protected API call |
| Invite token | UUID v4, stored in Firestore, validated server-side |
| Email delivery | Firebase Auth built-in emails for password reset; custom SMTP or a transactional email service (e.g., SendGrid, Resend) for invite emails |
| Password hashing | Handled by Firebase Auth (bcrypt/scrypt internally) |

---

## Database Schema (Firestore)

### Collection: `users`

One document per registered user (created on invite acceptance).

```
users/
  └── {firebaseAuthUid} (document)
        ├── uid: string              // Firebase Auth UID (matches document ID)
        ├── email: string
        ├── firstName: string
        ├── lastName: string
        ├── phone: string | null
        ├── role: string             // "admin" | "trainee"
        ├── status: string           // "active" | "disabled"
        ├── inviteId: string | null  // Reference to the invite that created this account
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Collection: `invites`

One document per invitation sent by an admin.

```
invites/
  └── {inviteId} (document)
        ├── email: string                // Trainee email
        ├── name: string | null          // Optional name provided by admin
        ├── token: string                // Secure invite token (UUID v4)
        ├── status: string               // "pending" | "accepted" | "expired"
        ├── invitedBy: string            // Admin UID who sent the invite
        ├── acceptedBy: string | null    // Trainee UID after acceptance
        ├── expiresAt: timestamp         // Invite expiry (default: 7 days from creation)
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Firestore Security Rules (Module 2 additions)

```javascript
// Users: read own profile, admin reads all
match /users/{userId} {
  allow read: if request.auth != null && (
    request.auth.uid == userId ||
    request.auth.token.role == 'admin'
  );
  allow write: if false; // managed via Admin SDK on server
}

// Invites: admin can read all, no client writes
match /invites/{inviteId} {
  allow read: if request.auth != null && request.auth.token.role == 'admin';
  allow write: if false; // managed via Admin SDK on server
}
```

---

## API Endpoints

All endpoints below are prefixed with `/api/auth` or `/api/users`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/verify-token` | Bearer token | Verifies the Firebase ID token and returns the user's role and profile. Used by frontend on app load. |
| `POST` | `/api/auth/validate-password` | None | Validates a password string against the password policy. Returns pass/fail and which rules failed. |

### Invite Management (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/invites` | Admin | Creates a new invite and sends the invitation email. Body: `{ email, name? }` |
| `GET` | `/api/invites` | Admin | Lists all invites with status and metadata. Supports filtering by status. |
| `POST` | `/api/invites/:inviteId/resend` | Admin | Resends an expired or pending invite (resets expiry, sends new email). |
| `DELETE` | `/api/invites/:inviteId` | Admin | Cancels a pending invite. |

### Invite Acceptance (Public — token-validated)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/invites/validate/:token` | None | Validates an invite token. Returns `{ valid, email, expired }`. |
| `POST` | `/api/invites/accept` | None | Accepts invite and creates account. Body: `{ token, firstName, lastName, phone?, password }`. Returns auth credentials. |

### User Management (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | Admin | Lists all users with role, status, and invite info. Supports filtering and search. |
| `GET` | `/api/users/:uid` | Admin | Returns full profile for a single user. |
| `PATCH` | `/api/users/:uid/status` | Admin | Enables or disables a user account. Body: `{ status: "active" | "disabled" }`. |

### Profile (Self)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/profile` | Any authenticated | Returns the current user's profile. |
| `PATCH` | `/api/profile` | Any authenticated | Updates own profile fields (firstName, lastName, phone). |
| `POST` | `/api/profile/change-password` | Any authenticated | Changes password. Body: `{ currentPassword, newPassword }`. Validates against policy. |

---

## UI Components

### Pages

| Component | Route | Role | Purpose |
|---|---|---|---|
| `LoginPage` | `/login` | Public | Email + password login form with forgot-password link |
| `ForgotPasswordPage` | `/forgot-password` | Public | Email input to trigger Firebase password reset |
| `InviteAcceptPage` | `/invite/:token` | Public | Validates token, shows account setup form |
| `UserManagementPage` | `/admin/users` | Admin | Table of all users with status, role, invite info, and actions |
| `InviteFormModal` | (modal on UserManagementPage) | Admin | Form to enter trainee email/name and send invite |
| `ProfilePage` | `/profile` | Any authenticated | View and edit own profile, change password |

### Shared Components

| Component | Purpose |
|---|---|
| `PasswordInput` | Password field with show/hide toggle and real-time policy validation indicator |
| `PasswordPolicyChecklist` | Visual checklist showing which policy rules are met/unmet as user types |
| `AuthContext` / `AuthProvider` | React context providing `user`, `role`, `loading`, `login()`, `logout()` |
| `ProtectedRoute` | Route guard: checks auth state and role, redirects accordingly |
| `RoleBadge` | Small badge displaying "Admin" or "Trainee" role |
| `StatusBadge` | Badge for account/invite status ("Active", "Disabled", "Pending", "Expired") |
| `InviteStatusFilter` | Dropdown filter for invite list (all, pending, accepted, expired) |
| `UserTable` | Sortable, searchable table of users with action buttons |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Admin can log in with email/password and is redirected to admin dashboard. | Manual test |
| 2 | Admin can send an invite to a trainee email; invite email is received with a valid link. | Manual test |
| 3 | Trainee can open the invite link, complete account setup with a policy-compliant password, and land on their course dashboard. | Manual test |
| 4 | Invite token that is older than 7 days is rejected with a clear expiry message. | Automated test |
| 5 | Admin can resend an expired invite. | Manual test |
| 6 | A user with `trainee` role cannot access any `/admin/*` route (server returns `403`, frontend redirects). | Automated test |
| 7 | A user with `admin` role cannot access trainee learning routes. | Automated test |
| 8 | Password that violates any policy rule is rejected on both frontend and server with specific rule failure messages. | Automated test |
| 9 | Unauthenticated requests to protected API endpoints return `401`. | Automated test |
| 10 | Admin can disable a trainee account; disabled trainee cannot log in. | Manual test |
| 11 | Admin can re-enable a disabled account; trainee can log in again. | Manual test |
| 12 | User can change their own password (must meet policy). | Manual test |
| 13 | "Forgot password" flow sends a reset email and allows password reset. | Manual test |
| 14 | No Firebase Auth user is created until invite acceptance is complete. | Automated test |

---

## Integration Points with Other Modules

| Target Module | What this module provides |
|---|---|
| Module 3 (CMS) | `requireAuth` + `requireRole('admin')` middleware for all CMS endpoints; admin identity on `req.user` |
| Module 4 (Content) | `requireAuth` + `requireRole('trainee')` middleware for learner content routes; trainee identity for progress tracking |
| Module 5 (Quiz) | Authenticated trainee identity for linking quiz attempts to user |
| Module 6 (Progress) | User UID available on every request for progress record creation |
| Module 7 (Dashboard) | Admin auth for dashboard access; user list for performance views |
| Module 8 (Reminders) | User email and status available for reminder targeting; invite email infrastructure reusable for reminder emails |
