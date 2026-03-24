# Module 7: Admin Dashboard & Reporting

## Goal

Provide admins with a centralized dashboard and reporting views that give at-a-glance visibility into trainee performance, course completion, assessment results, and operational readiness. This module pulls together data from progress tracking, enrollments, quiz attempts, and user records into actionable admin-facing views — enabling the business to identify who is on track, who is falling behind, and who is ready for in-person practical assessment.

## Dependencies

- **Module 1** — React app shell, Express scaffold.
- **Module 2** — Admin authentication and role enforcement, user records.
- **Module 3** — Course, module, lesson, and enrollment data.
- **Module 5** — Quiz attempt data (scores, pass/fail, attempt counts).
- **Module 6** — `courseProgress` and `moduleProgress` records for all trainees.

## Depended on by

- No downstream module dependencies. This is a consumer of data produced by Modules 2–6.

---

## Detailed Features

### 7.1 Admin Home Dashboard

The first page an admin sees after login. Provides a high-level summary of the platform.

**Summary cards (top row):**

| Card | Data |
|---|---|
| Total Trainees | Count of active trainee accounts |
| Enrolled | Count of trainees with active enrollments |
| Completed | Count of trainees who have completed the course |
| Overdue | Count of trainees past their course due date and not yet completed |
| Average Progress | Mean course percentage across all active enrollments |

**Quick-access sections:**

- **At-Risk Trainees** — list of trainees who are overdue or have very low progress (below 25% with > 50% of time elapsed toward due date). Shows name, current module, progress, due date, days overdue.
- **Recent Activity** — last 10 trainee events: lesson completions, quiz submissions, exam passes/fails, course completions. Shows trainee name, event type, timestamp.
- **Course Overview** — the active course with module-by-module completion funnel (how many trainees have completed each module).

### 7.2 Trainee Performance Table

A detailed, sortable, searchable table of all enrolled trainees.

**Columns:**

| Column | Data |
|---|---|
| Name | First + last name (links to trainee detail) |
| Email | Trainee email |
| Status | Enrollment status: Active, Completed, Withdrawn |
| Current Module | Module the trainee is currently working on |
| Progress | Course percentage with visual progress bar |
| Due Date | Course due date |
| Days Remaining / Overdue | Calculated from due date (green if remaining, red if overdue) |
| Last Active | Timestamp of last lesson interaction |
| Actions | View detail button |

**Features:**
- Sort by any column (ascending/descending).
- Search by name or email.
- Filter by status: All, Active, Completed, Overdue, Withdrawn.
- Export to CSV.

### 7.3 Trainee Detail View

Detailed progress view for a single trainee, accessed from the performance table.

**Sections:**

**Profile summary:**
- Name, email, phone, account status, enrollment date, due date.

**Course progress:**
- Overall progress bar and percentage.
- Module-by-module breakdown table:

| Module | Status | Progress | Lessons Done | Exam Score | Exam Attempts |
|---|---|---|---|---|---|
| Module 1: Orientation | Completed | 100% | 4/4 | N/A | N/A |
| Module 2: Core Theory | In Progress | 60% | 3/5 | — | — |
| Module 3: Technique | Locked | 0% | 0/4 | — | — |

**Assessment history:**
- Table of all quiz/exam attempts across the course:

| Assessment | Type | Attempt # | Score | Pass/Fail | Date |
|---|---|---|---|---|---|
| Module 2 Quiz | Quiz | 1 | 80% | — | 2026-03-15 |
| Module 4 Checkpoint | Exam | 1 | 55% | Fail | 2026-03-18 |
| Module 4 Checkpoint | Exam | 2 | 72% | Pass | 2026-03-19 |

**Activity timeline:**
- Chronological list of all tracked events: lesson completions, quiz attempts, module unlocks, exam results.

**Admin actions on this page:**
- Reset exam attempts (calls Module 5 API).
- Change due date (calls Module 3 enrollment API).
- Disable/enable account (calls Module 2 API).

### 7.4 Module Completion Funnel

A visual funnel or bar chart showing how many trainees have completed each module.

```
Module 1: ████████████████████  18/20 trainees (90%)
Module 2: ████████████          12/20 trainees (60%)
Module 3: ████████              8/20 trainees (40%)
Module 4: █████                 5/20 trainees (25%)
Module 5: ███                   3/20 trainees (15%)
Module 6: █                     1/20 trainees (5%)
```

- Helps admin identify where trainees are dropping off or getting stuck.
- Clickable bars navigate to a filtered trainee list showing who is in that module.

### 7.5 Overdue Trainees Report

Dedicated view listing all trainees whose course due date has passed and who have not completed the course.

**Columns:** Name, Email, Progress, Due Date, Days Overdue, Current Module, Last Active.

- Sorted by days overdue (most overdue first).
- Admin can trigger reminder emails directly from this view (links to Module 8).

### 7.6 Assessment Performance Report

Aggregated view of quiz and exam performance across all trainees.

**Per assessment:**

| Metric | Description |
|---|---|
| Assessment name | Quiz or exam title |
| Type | Quiz / Exam |
| Total Attempts | Count of all attempts |
| Unique Trainees | Count of trainees who attempted |
| Average Score | Mean score across all attempts |
| Pass Rate | Percentage of attempts that passed (exams only) |
| First-Attempt Pass Rate | Percentage of trainees who passed on first try |

- Helps admin identify assessments that are too hard or too easy.

### 7.7 CSV Export

Admin can export the following as CSV files:

- Trainee performance table (all columns).
- Overdue trainees report.
- Assessment performance summary.
- Individual trainee assessment history.

Export is triggered by a download button on each view. Server generates the CSV and returns it as a file download.

### 7.8 Course Completion Report

Summary of overall course outcomes.

**Metrics:**

| Metric | Description |
|---|---|
| Total Enrolled | All-time enrollment count |
| Currently Active | Trainees still in progress |
| Completed | Trainees who finished the course |
| Completion Rate | Completed / Total Enrolled × 100 |
| Average Completion Time | Mean days from enrollment to completion |
| Withdrawn | Trainees removed from the course |
| Overdue | Active trainees past due date |

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Data freshness | Dashboard reads directly from Firestore progress collections — data is current as of last progress update |
| Aggregations | Computed on the server per request (no pre-aggregated materialized views in MVP) |
| CSV export | Server-side generation using a lightweight CSV library (e.g., `json2csv`) |
| Pagination | Trainee table supports server-side pagination (default 25 per page) |
| Sorting | Server-side sorting on key columns (progress, due date, last active, name) |
| Search | Server-side text search on name and email fields |

---

## Database Schema (Firestore)

Module 7 does not introduce new collections. It reads from existing collections defined in other modules:

| Collection | Source Module | Used for |
|---|---|---|
| `users` | Module 2 | Trainee names, emails, account status |
| `enrollments` | Module 3 | Enrollment status, due dates |
| `courses` | Module 3 | Course metadata |
| `modules` | Module 3 | Module names and order |
| `courseProgress` | Module 6 | Per-trainee course-level progress |
| `moduleProgress` | Module 6 | Per-trainee module-level progress |
| `lessonProgress` | Module 4 | Per-trainee lesson-level progress |
| `quizAttempts` | Module 5 | Assessment scores, pass/fail, attempt history |
| `quizzes` | Module 5 | Assessment names and types |

---

## API Endpoints

All endpoints require `requireAuth` + `requireRole('admin')`.

### Dashboard Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/dashboard/summary` | Admin | Returns summary cards data: total trainees, enrolled, completed, overdue, average progress. |
| `GET` | `/api/admin/dashboard/at-risk` | Admin | Returns list of at-risk trainees (overdue or low progress). |
| `GET` | `/api/admin/dashboard/recent-activity` | Admin | Returns last N trainee events (lesson completions, exam results, etc.). Query param: `limit` (default 10). |

### Trainee Performance

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/trainees` | Admin | Paginated, sortable, searchable list of all enrolled trainees with progress data. Query params: `page`, `limit`, `sort`, `order`, `search`, `status`. |
| `GET` | `/api/admin/trainees/:traineeId/progress` | Admin | Full trainee detail: profile, course progress, module breakdown, assessment history, activity timeline. |

### Reports

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/reports/module-funnel` | Admin | Module completion funnel: per-module count of trainees who have completed each module. |
| `GET` | `/api/admin/reports/overdue` | Admin | Overdue trainees list with progress and days overdue. |
| `GET` | `/api/admin/reports/assessments` | Admin | Assessment performance summary: per-quiz/exam stats (attempts, avg score, pass rate). |
| `GET` | `/api/admin/reports/course-completion` | Admin | Course completion metrics: enrolled, active, completed, rate, avg time, withdrawn, overdue. |

### CSV Export

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/export/trainees` | Admin | Export trainee performance table as CSV. Same filters as trainee list. |
| `GET` | `/api/admin/export/overdue` | Admin | Export overdue trainees as CSV. |
| `GET` | `/api/admin/export/assessments` | Admin | Export assessment performance as CSV. |
| `GET` | `/api/admin/export/trainees/:traineeId/attempts` | Admin | Export individual trainee's assessment history as CSV. |

---

## UI Components

### Pages

| Component | Route | Role | Purpose |
|---|---|---|---|
| `AdminDashboardPage` | `/admin/dashboard` | Admin | Home dashboard with summary cards, at-risk list, recent activity, course funnel |
| `TraineeListPage` | `/admin/trainees` | Admin | Sortable, searchable, filterable trainee performance table |
| `TraineeDetailPage` | `/admin/trainees/:traineeId` | Admin | Full trainee progress view with module breakdown, assessment history, and admin actions |
| `ReportsPage` | `/admin/reports` | Admin | Hub page with links to specific reports |
| `OverdueReportPage` | `/admin/reports/overdue` | Admin | Overdue trainees table |
| `AssessmentReportPage` | `/admin/reports/assessments` | Admin | Assessment performance stats table |
| `CourseCompletionReportPage` | `/admin/reports/completion` | Admin | Course completion metrics |

### Dashboard Components

| Component | Purpose |
|---|---|
| `SummaryCard` | Stat card with label, value, icon, and optional trend/color indicator |
| `AtRiskTraineeList` | Compact list of at-risk trainees with name, progress, due date, and "View" link |
| `RecentActivityFeed` | Chronological feed of recent events with trainee name, event type icon, and timestamp |
| `ModuleFunnelChart` | Horizontal bar chart showing per-module completion counts |

### Table Components

| Component | Purpose |
|---|---|
| `TraineeTable` | Full-featured data table: sortable columns, search bar, status filter tabs, pagination, export button |
| `TraineeRow` | Row in trainee table with progress bar, status badge, due date indicator |
| `SortableColumnHeader` | Column header with sort direction indicator (asc/desc/none) |
| `PaginationControls` | Page navigation with page size selector |
| `SearchInput` | Debounced search input for name/email filtering |
| `StatusFilterTabs` | Tab bar: All | Active | Completed | Overdue | Withdrawn |
| `ExportCSVButton` | Button that triggers CSV download for the current view/filters |

### Trainee Detail Components

| Component | Purpose |
|---|---|
| `TraineeProfileCard` | Profile summary: name, email, phone, status, enrollment date |
| `ModuleBreakdownTable` | Per-module progress table with status, percentage, lesson count, exam score/attempts |
| `AssessmentHistoryTable` | Table of all quiz/exam attempts with score, pass/fail, date |
| `ActivityTimeline` | Chronological list of trainee events with icons and timestamps |
| `AdminActionsPanel` | Action buttons: Reset Exam Attempts, Change Due Date, Disable Account |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Admin dashboard loads with correct summary card values matching Firestore data. | Automated test |
| 2 | At-risk trainee list correctly identifies trainees who are overdue or below 25% progress with > 50% time elapsed. | Automated test |
| 3 | Recent activity feed shows the last 10 events in correct chronological order. | Automated test |
| 4 | Module funnel chart shows accurate per-module completion counts. | Automated test |
| 5 | Trainee table supports sorting by name, progress, due date, and last active. | Manual test |
| 6 | Trainee table search filters by name and email with debounced input. | Manual test |
| 7 | Trainee table status filter correctly shows Active, Completed, Overdue, and Withdrawn trainees. | Manual test |
| 8 | Trainee table supports pagination with page size selection. | Manual test |
| 9 | Trainee detail view shows accurate module-by-module breakdown matching progress records. | Automated test |
| 10 | Assessment history shows all attempts with correct scores and pass/fail status. | Automated test |
| 11 | CSV export of trainee table downloads a valid CSV with all visible columns and applied filters. | Manual test |
| 12 | CSV export of overdue report downloads a valid CSV. | Manual test |
| 13 | Course completion report metrics match aggregated enrollment and progress data. | Automated test |
| 14 | Admin can reset exam attempts from trainee detail page (action calls Module 5 API successfully). | Manual test |

---

## Integration Points with Other Modules

| Target Module | What this module consumes |
|---|---|
| Module 2 (Auth) | User records for trainee names, emails, and account status |
| Module 3 (CMS) | Course/module structure for context; enrollment records for due dates and assignment data |
| Module 5 (Quiz Engine) | Quiz attempt records for assessment reporting; quiz definitions for assessment names |
| Module 6 (Progress) | `courseProgress` and `moduleProgress` records — the primary data source for all dashboard views |
| Module 8 (Reminders) | Overdue report view allows admin to trigger reminders (links to Module 8 functionality) |
