# Module 6: Progress Tracking & Prerequisite Progression

## Goal

Implement the engine that calculates trainee progress at every level (lesson, module, course), enforces prerequisite-based module unlocking, and manages the module state machine. This is the "intelligence" layer that ties content completion (Module 4) and exam results (Module 5) into a coherent, gated learning pathway. The module ensures trainees can only advance when they have genuinely met all requirements.

## Dependencies

- **Module 1** — Firestore connection, Express scaffold.
- **Module 2** — Trainee identity on every request.
- **Module 3** — Course/module/lesson structure, `completionCriteria` per module, enrollment records.
- **Module 4** — `lessonProgress` records created on content completion.
- **Module 5** — `quizAttempts` records with exam pass/fail status.

## Depended on by

- **Module 7** (Dashboard) — reads progress data for admin reporting.
- **Module 8** (Reminders) — reads progress status to identify incomplete trainees.

---

## Detailed Features

### 6.1 Module State Machine

Each module has a status per trainee, managed in a `moduleProgress` document:

```
┌────────────┐     Module prerequisites met     ┌─────────────┐     All criteria met     ┌───────────┐
│   locked   │ ─────────────────────────────────>│ in_progress │ ──────────────────────> │ completed │
└────────────┘                                   └─────────────┘                         └───────────┘
                                                        │
                                                        │  (Module 1 has no prerequisites;
                                                        │   it starts as in_progress for all
                                                        │   enrolled trainees)
```

| State | Meaning |
|---|---|
| `locked` | Prerequisite module(s) not yet completed. Trainee cannot access content. |
| `in_progress` | Module is unlocked. Trainee is working through content. |
| `completed` | All completion criteria are satisfied. |

### 6.2 Prerequisite Logic

Prerequisite rules follow a strict sequential model for MVP:

- **Module 1** (first in order) is automatically `in_progress` for every enrolled trainee — no prerequisites.
- **Module N** (where N > 1) requires **Module N-1** to be `completed` before it unlocks.
- This means modules unlock one at a time in strict order: 1 → 2 → 3 → 4 → 5 → 6.

The engine evaluates prerequisites by:

1. Looking up the previous module in order (for the same course).
2. Checking if the trainee's `moduleProgress` for that previous module has status `completed`.
3. If yes, the current module transitions from `locked` to `in_progress`.

### 6.3 Completion Criteria Evaluation

When a lesson completion or exam pass event occurs, the engine recalculates the parent module's completion status.

**Per-module evaluation logic:**

```
function evaluateModuleCompletion(traineeId, moduleId):
    module = getModule(moduleId)
    lessons = getLessonsForModule(moduleId)  // published lessons only
    lessonProgressRecords = getLessonProgress(traineeId, moduleId)

    // Check 1: All lessons completed
    allLessonsCompleted = every lesson has a lessonProgress with status "completed"

    // Check 2: Exam passed (if module has an exam)
    examLessons = lessons where type == "exam"
    examPassed = true  // default if no exam exists
    if examLessons is not empty:
        for each examLesson:
            quizId = examLesson.content.quizId
            passingAttempt = getPassingAttempt(traineeId, quizId)
            if passingAttempt does not exist:
                examPassed = false
                break

    // Final determination
    if allLessonsCompleted AND examPassed:
        set moduleProgress status to "completed"
        set completedAt timestamp
        trigger cascading unlock check for next module
    else:
        keep moduleProgress status as "in_progress"
```

### 6.4 Cascading Unlock

When a module is marked `completed`, the engine immediately checks the next module in sequence:

1. Find the next module by `order` in the same course.
2. If it exists and its `moduleProgress` status is `locked`, transition it to `in_progress`.
3. This cascading check happens synchronously within the same API request to avoid race conditions.

### 6.5 Course Completion

When the **last module** (Module 6 in MVP) is marked `completed`:

1. Update the `courseProgress` status to `completed`.
2. Set `completedAt` timestamp.
3. Update the `enrollment` status to `completed` and set `completedAt`.
4. This represents the trainee being "theory ready" for in-person practical assessment.

### 6.6 Progress Percentage Calculation

**Module-level percentage:**
```
modulePercent = (completedLessonCount / totalPublishedLessonCount) × 100
```

**Course-level percentage:**
```
coursePercent = (completedModuleCount / totalPublishedModuleCount) × 100
```

An alternative weighted formula for course percentage (more granular):
```
coursePercent = (totalCompletedLessonsAcrossAllModules / totalPublishedLessonsAcrossAllModules) × 100
```

MVP uses the **lesson-weighted formula** for course percentage to provide smoother progress increments.

### 6.7 Progress Recalculation Triggers

The engine recalculates progress when any of these events occur:

| Trigger event | Source module | What is recalculated |
|---|---|---|
| Reading marked as completed | Module 4 | Module percentage, module completion check |
| Video auto-completed (≥ 90%) | Module 4 | Module percentage, module completion check |
| Quiz submitted | Module 5 | Module percentage (lesson marked completed) |
| Exam passed | Module 5 | Module percentage, module completion check, cascading unlock |
| Exam failed | Module 5 | No change to module status (attempt recorded only) |
| Admin resets exam attempts | Module 5 | Module completion reverts to `in_progress` if previously `completed` via that exam |

### 6.8 Enrollment Initialization

When a trainee is enrolled in a course (Module 3 enrollment creation):

1. Create a `courseProgress` document for the trainee.
2. Create a `moduleProgress` document for every published module in the course.
3. Set Module 1 (first in order) to `in_progress`; all others to `locked`.
4. No `lessonProgress` records are created yet — they are created on first interaction.

### 6.9 Admin Progress Visibility

- Admin can view any trainee's progress at course, module, and lesson level via API (consumed by Module 7 dashboard).
- Admin can see which module each trainee is currently on, what percentage is complete, and what is blocking progression.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Recalculation | Synchronous within the triggering API request (not eventual consistency) |
| Cascading unlock | Evaluated immediately after module completion, within the same transaction |
| Firestore transactions | Use Firestore transactions for module completion + next module unlock to prevent race conditions |
| Progress initialization | Batch write of all `moduleProgress` documents on enrollment creation |
| Idempotency | Repeated calls to recalculate produce the same result (safe to retry) |

---

## Database Schema (Firestore)

### Collection: `courseProgress`

One document per trainee per course. Tracks overall course-level progress.

```
courseProgress/
  └── {traineeId}_{courseId} (document)
        ├── courseId: string
        ├── traineeId: string
        ├── status: string               // "in_progress" | "completed"
        ├── percentComplete: number      // 0–100 (lesson-weighted)
        ├── completedModules: number     // Count of completed modules
        ├── totalModules: number         // Count of published modules
        ├── completedLessons: number     // Count of completed lessons across all modules
        ├── totalLessons: number         // Count of published lessons across all modules
        ├── currentModuleId: string | null  // Module the trainee is currently working on
        ├── currentModuleOrder: number | null
        ├── startedAt: timestamp         // First lesson interaction
        ├── completedAt: timestamp | null
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Collection: `moduleProgress`

One document per trainee per module. Tracks module-level status and progress.

```
moduleProgress/
  └── {traineeId}_{moduleId} (document)
        ├── moduleId: string
        ├── courseId: string             // Denormalized
        ├── traineeId: string
        ├── status: string               // "locked" | "in_progress" | "completed"
        ├── percentComplete: number      // 0–100
        ├── completedLessons: number     // Count of completed lessons in this module
        ├── totalLessons: number         // Count of published lessons in this module
        ├── examPassed: boolean          // Whether the module exam (if any) has been passed
        ├── allLessonsCompleted: boolean // Whether all lessons are completed
        ├── unlockedAt: timestamp | null // When module transitioned to in_progress
        ├── completedAt: timestamp | null
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Firestore Security Rules (Module 6 additions)

```javascript
// Course progress: trainee reads own, admin reads all
match /courseProgress/{progressId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.uid == resource.data.traineeId
  );
  allow write: if false;
}

// Module progress: trainee reads own, admin reads all
match /moduleProgress/{progressId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.uid == resource.data.traineeId
  );
  allow write: if false;
}
```

---

## API Endpoints

### Trainee Progress (read-only for trainee — writes happen internally)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/my/progress/courses/:courseId` | Trainee | Returns `courseProgress` for the trainee: status, percentage, module breakdown summary. |
| `GET` | `/api/my/progress/courses/:courseId/modules` | Trainee | Returns all `moduleProgress` records for the trainee in this course, ordered by module order. |
| `GET` | `/api/my/progress/modules/:moduleId` | Trainee | Returns detailed `moduleProgress` including lesson-level completion status. |

### Admin Progress Views

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/progress/courses/:courseId` | Admin | Returns all trainee progress records for a course (one entry per enrolled trainee). |
| `GET` | `/api/admin/progress/courses/:courseId/trainees/:traineeId` | Admin | Returns detailed progress for a single trainee: course, module, and lesson level. |
| `GET` | `/api/admin/progress/courses/:courseId/summary` | Admin | Aggregated summary: total enrolled, total completed, average progress, per-module completion counts. |

### Internal Endpoints (called by Module 4 and Module 5 handlers, not directly by the client)

These are service-layer functions, not exposed as HTTP endpoints. They are called internally within the server when a lesson completion or exam event occurs.

| Function | Trigger | Action |
|---|---|---|
| `recalculateModuleProgress(traineeId, moduleId)` | Lesson completed or exam passed | Recalculates module percentage, checks completion criteria, updates `moduleProgress`. |
| `evaluateCascadingUnlock(traineeId, courseId, completedModuleOrder)` | Module marked completed | Checks and unlocks the next module in sequence. |
| `recalculateCourseProgress(traineeId, courseId)` | Any module progress change | Updates `courseProgress` percentages and counts. |
| `initializeProgress(traineeId, courseId)` | Enrollment created (Module 3) | Creates `courseProgress` and all `moduleProgress` documents. |

---

## UI Components

Module 6 does not introduce new pages — its data powers the UI components defined in Module 4 (trainee views) and Module 7 (admin views). The components below are shared progress-display widgets used across both.

| Component | Purpose |
|---|---|
| `ProgressBar` | Reusable progress bar with percentage label. Accepts `percent` and optional color variant. |
| `ModuleStatusBadge` | Badge showing `Locked` (grey), `In Progress` (blue), `Completed` (green) with icon. |
| `CourseCompletionCard` | Summary card showing overall course progress: percentage, completed/total modules, status. Used on trainee dashboard and admin trainee detail. |
| `ModuleProgressRow` | Row in a progress table: module name, status badge, percentage bar, lesson count, exam status. Used in both trainee and admin views. |
| `PrerequisiteTooltip` | Tooltip shown on locked modules: "Complete [Module X] to unlock this module." |
| `CompletionCelebration` | Full-screen overlay shown when trainee completes the entire course: congratulations message, completion timestamp, prompt to prepare for practical assessment. |
| `CourseCompleteBanner` | Persistent banner at top of dashboard after course completion: "You have completed all theory modules. Your admin has been notified." |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | On enrollment, Module 1 is `in_progress` and Modules 2–6 are `locked`. | Automated test |
| 2 | Completing all lessons in Module 1 (without an exam) marks Module 1 as `completed`. | Automated test |
| 3 | Completing all lessons + passing the exam in a module marks it as `completed`. | Automated test |
| 4 | When Module N is completed, Module N+1 automatically transitions from `locked` to `in_progress`. | Automated test |
| 5 | A trainee cannot access lessons in a `locked` module via API (returns `403`). | Automated test |
| 6 | Module percentage updates correctly as lessons are completed. | Automated test |
| 7 | Course percentage uses the lesson-weighted formula and updates on every lesson completion. | Automated test |
| 8 | Completing the last module (Module 6) marks the course as `completed` and updates the enrollment. | Automated test |
| 9 | Admin can view any trainee's progress at course, module, and lesson level. | Manual test |
| 10 | Course progress summary correctly reports enrolled count, completed count, and average progress. | Automated test |
| 11 | If admin resets exam attempts and the module was `completed` via that exam, the module reverts to `in_progress`. | Automated test |
| 12 | Progress recalculation is idempotent: calling it twice produces the same result. | Automated test |
| 13 | Cascading unlock does not skip modules (strict sequential order enforced). | Automated test |
| 14 | Completion celebration is shown when the trainee finishes the last module. | Manual test |

---

## Integration Points with Other Modules

| Target Module | What this module provides |
|---|---|
| Module 4 (Content Delivery) | Module lock/unlock status that controls trainee access to module content; progress percentages displayed on dashboard and module views |
| Module 5 (Quiz Engine) | Consumes exam pass/fail events to trigger module completion evaluation |
| Module 7 (Dashboard) | `courseProgress` and `moduleProgress` collections power all admin reporting views |
| Module 8 (Reminders) | `courseProgress` status and `enrollment.dueDate` together determine whether a trainee is overdue |
