# Module 8: Reminder Automation & Engagement Prompts

## Goal

Automate email reminders to trainees who are incomplete past their course due date, and provide admin with visibility into who needs follow-up. This module reduces manual chasing, improves completion rates, and gives admins configurable control over reminder behavior — while keeping the MVP implementation focused and simple.

## Dependencies

- **Module 1** — Express scaffold, environment configuration, scheduled task infrastructure.
- **Module 2** — User records (email addresses), email sending infrastructure (transactional email service configured for invite emails).
- **Module 3** — Enrollment records with due dates.
- **Module 6** — `courseProgress` records to determine completion status.

## Depended on by

- No downstream module dependencies. This is the final module in the build sequence.

---

## Detailed Features

### 8.1 Reminder Trigger Logic

The core reminder trigger for MVP: **trainee is incomplete past their course due date.**

A trainee qualifies for a reminder when ALL of the following are true:

1. Enrollment status is `active` (not `completed`, not `withdrawn`).
2. Course `dueDate` exists and is in the past.
3. `courseProgress.status` is NOT `completed`.
4. The trainee's account is not `disabled`.
5. The trainee has not already received a reminder within the configured cooldown period.

### 8.2 Reminder Schedule

Reminders are sent by a **scheduled job** that runs on a configurable cadence.

| Setting | Default | Description |
|---|---|---|
| Check frequency | Daily at 9:00 AM (configurable) | How often the system scans for overdue trainees |
| Cooldown period | 3 days | Minimum time between reminders to the same trainee |
| Max reminders | 5 | Maximum number of reminders per trainee per enrollment (prevents infinite emails) |

- The scheduled job runs server-side (cron job via `node-cron` or a platform scheduler like Cloud Scheduler calling an API endpoint).
- Each run scans all active enrollments, evaluates the trigger conditions, and queues reminders for qualifying trainees.

### 8.3 Reminder Email Content

Each reminder email includes:

- **Subject:** "Reminder: Complete your Elevate Pilates training"
- **Body:**
  - Trainee's first name.
  - Course name.
  - Current progress percentage.
  - Current module they're on.
  - Due date (and how many days overdue).
  - A direct link to their course dashboard.
  - A closing note: "If you need assistance, please contact your program administrator."

Email content is generated from a server-side template (HTML email template stored in the codebase, not in the database).

### 8.4 Reminder Log

Every reminder sent is recorded in a `reminderLog` collection:

- Tracks which trainee received which reminder and when.
- Tracks the reminder number (1st, 2nd, 3rd…) for this enrollment.
- Used to enforce the cooldown period and max reminders limit.
- Visible to admin for audit and follow-up purposes.

### 8.5 Admin Reminder Configuration

Admin can view and update reminder settings from the admin panel:

- Enable/disable reminder automation globally.
- Set check frequency (cron expression or simple dropdown: daily, every 2 days, weekly).
- Set cooldown period (days between reminders to the same trainee).
- Set max reminders per enrollment.
- Changes are stored in the `systemConfig` document.

### 8.6 Admin Reminder Visibility

Admin can see:

- **Reminder history**: a log of all reminders sent, with trainee name, email, date, and reminder number.
- **Pending reminders**: trainees who currently qualify for a reminder (would be sent on next scheduled run).
- **Reminder status per trainee**: on the trainee detail page (Module 7), a section showing how many reminders have been sent and when.

### 8.7 Manual Reminder Trigger

Admin can manually send a reminder to a specific trainee from:

- The overdue report page (Module 7).
- The trainee detail page (Module 7).

Manual reminders:
- Bypass the cooldown period.
- Count toward the max reminders limit.
- Are logged in the `reminderLog` with `trigger: "manual"`.

### 8.8 Pre-Due-Date Warning (Enhancement)

In addition to post-due-date reminders, the system sends a single **warning email** when a trainee is approaching their due date:

- Sent **3 days before** the due date (configurable).
- Only sent if the trainee has NOT yet completed the course.
- Subject: "Your Elevate Pilates training is due in 3 days"
- Body includes current progress, remaining modules, and a link to continue.
- Logged as `type: "warning"` in `reminderLog`.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Scheduler | `node-cron` for self-hosted Express server, or Cloud Scheduler + HTTP endpoint |
| Email service | Same transactional email service as Module 2 invites (SendGrid, Resend, or similar) |
| Email templates | HTML templates rendered server-side with dynamic variables (trainee name, progress, etc.) |
| Cooldown enforcement | Server checks `reminderLog` for the trainee's most recent reminder timestamp before sending |
| Idempotency | If the scheduled job runs twice in quick succession, duplicate reminders are prevented by the cooldown check |
| Failure handling | If email sending fails, the reminder is NOT logged (will be retried on next scheduled run) |
| Timezone | All due date comparisons use UTC; display in admin UI converts to local timezone |

---

## Database Schema (Firestore)

### Collection: `reminderLog`

One document per reminder sent.

```
reminderLog/
  └── {reminderId} (document)
        ├── traineeId: string
        ├── traineeEmail: string          // Denormalized for log readability
        ├── traineeName: string           // Denormalized
        ├── enrollmentId: string
        ├── courseId: string
        ├── type: string                  // "overdue" | "warning"
        ├── trigger: string              // "automated" | "manual"
        ├── reminderNumber: number       // Sequential count for this enrollment (1, 2, 3…)
        ├── progressAtSend: number       // Course progress % when reminder was sent
        ├── currentModuleAtSend: string  // Module name the trainee was on
        ├── dueDateAtSend: timestamp     // Due date at time of sending
        ├── daysOverdue: number          // 0 for warnings, positive for overdue reminders
        ├── emailStatus: string          // "sent" | "failed"
        ├── sentAt: timestamp
        └── createdAt: timestamp
```

### Addition to `systemConfig/appSettings`

```
systemConfig/
  └── appSettings (document)
        └── reminderSettings: map
              ├── enabled: boolean           // true
              ├── cronSchedule: string       // "0 9 * * *" (daily at 9 AM)
              ├── cooldownDays: number       // 3
              ├── maxReminders: number       // 5
              └── warningDaysBefore: number  // 3
```

### Firestore Security Rules (Module 8 additions)

```javascript
// Reminder log: admin reads all, no client writes
match /reminderLog/{reminderId} {
  allow read: if request.auth != null && request.auth.token.role == 'admin';
  allow write: if false;
}
```

---

## API Endpoints

### Reminder Configuration (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/reminders/settings` | Admin | Get current reminder settings from `systemConfig`. |
| `PATCH` | `/api/admin/reminders/settings` | Admin | Update reminder settings. Body: `{ enabled?, cronSchedule?, cooldownDays?, maxReminders?, warningDaysBefore? }` |

### Reminder History and Visibility (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/reminders/log` | Admin | Paginated list of all reminders sent. Query params: `page`, `limit`, `traineeId?`, `type?`, `trigger?`. |
| `GET` | `/api/admin/reminders/pending` | Admin | List of trainees who currently qualify for a reminder (would be sent on next run). |
| `GET` | `/api/admin/reminders/trainees/:traineeId` | Admin | Reminder history for a specific trainee. |

### Manual Reminder (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/reminders/send` | Admin | Manually send a reminder to a specific trainee. Body: `{ traineeId, enrollmentId }`. Bypasses cooldown, logged as manual. |

### Scheduled Job Trigger

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/internal/reminders/run` | Internal (API key or server-only) | Triggered by the cron scheduler. Scans all active enrollments, evaluates trigger conditions, sends reminders. Returns count of reminders sent. |

---

## UI Components

### Pages

| Component | Route | Role | Purpose |
|---|---|---|---|
| `ReminderSettingsPage` | `/admin/reminders/settings` | Admin | Form to configure reminder settings (enable/disable, schedule, cooldown, max reminders, warning days) |
| `ReminderLogPage` | `/admin/reminders/log` | Admin | Paginated table of all sent reminders with filters |
| `PendingRemindersPage` | `/admin/reminders/pending` | Admin | List of trainees who will receive a reminder on the next run |

### Components

| Component | Purpose |
|---|---|
| `ReminderSettingsForm` | Form with toggle (enabled/disabled), schedule dropdown, cooldown input, max reminders input, warning days input |
| `ReminderLogTable` | Table with columns: trainee name, email, type, trigger, reminder #, progress at send, days overdue, date sent |
| `ReminderLogRow` | Row component with type badge (overdue/warning) and trigger badge (automated/manual) |
| `PendingReminderList` | List of trainees qualifying for reminders: name, progress, due date, days overdue, "Send Now" button |
| `SendReminderButton` | Button to manually trigger a reminder for a specific trainee (with confirmation dialog) |
| `ReminderHistorySection` | Section on the trainee detail page (Module 7) showing reminder count and history for that trainee |
| `ReminderStatusBadge` | Badge showing number of reminders sent (e.g., "3/5 reminders sent") |
| `CronScheduleDropdown` | Dropdown with human-readable schedule options: Daily, Every 2 days, Every 3 days, Weekly |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Scheduled job runs at the configured time and identifies all overdue, incomplete trainees. | Automated test |
| 2 | Reminder email is sent to qualifying trainees with correct content (name, progress, module, due date, link). | Manual test (check email) |
| 3 | Cooldown period is respected: trainee does not receive a second reminder within the cooldown window. | Automated test |
| 4 | Max reminders limit is enforced: trainee does not receive more than the configured maximum. | Automated test |
| 5 | Each reminder is logged in `reminderLog` with all metadata. | Automated test |
| 6 | Admin can view reminder log with filtering by trainee, type, and trigger. | Manual test |
| 7 | Admin can see pending reminders (trainees who qualify for next run). | Manual test |
| 8 | Admin can manually send a reminder to a specific trainee; it bypasses cooldown and is logged as manual. | Manual test |
| 9 | Admin can enable/disable reminders globally; disabled state prevents all automated sends. | Automated test |
| 10 | Admin can update cooldown, max reminders, and schedule; changes take effect on next run. | Manual test |
| 11 | Pre-due-date warning email is sent 3 days before due date to incomplete trainees. | Automated test |
| 12 | Completed trainees do not receive reminders. | Automated test |
| 13 | Disabled/withdrawn trainees do not receive reminders. | Automated test |
| 14 | Trainee detail page (Module 7) shows reminder history for that trainee. | Manual test |
| 15 | If email sending fails, no `reminderLog` entry is created and the trainee is retried on next run. | Automated test |

---

## Integration Points with Other Modules

| Target Module | What this module consumes |
|---|---|
| Module 2 (Auth) | Trainee email addresses and account status; reuses the same transactional email service |
| Module 3 (CMS) | Enrollment records with due dates; course metadata for email content |
| Module 6 (Progress) | `courseProgress` status and percentage to determine overdue/incomplete state and populate email content |
| Module 7 (Dashboard) | `ReminderHistorySection` component is embedded in the trainee detail page; "Send Reminder" button on overdue report page triggers the manual send API |
