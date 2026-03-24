# Module 4: Learning Content Delivery

## Goal

Deliver the trainee-facing learning experience — the pages and components trainees interact with to consume course content. This module covers the course dashboard, module view, lesson consumption (readings and videos), navigation between lessons, content completion tracking at the lesson level, and the mobile-responsive learner UI. Quizzes and exams are rendered by Module 5; this module provides the container and navigation around them.

## Dependencies

- **Module 1** — React app shell, layout components, Firebase Storage configured.
- **Module 2** — Trainee authentication, `requireAuth` + `requireRole('trainee')` middleware, `AuthContext`.
- **Module 3** — Published courses, modules, lessons, enrollments, content hierarchy, and Firestore schema.

## Depended on by

- **Module 5** (Quiz Engine) — quiz/exam lessons are rendered inside the lesson viewer shell provided here.
- **Module 6** (Progress Tracking) — lesson completion events emitted here feed into progress calculations.

---

## Detailed Features

### 4.1 Trainee Course Dashboard

The landing page after login for a trainee. Shows the assigned course at a glance.

- Displays course title, description, and due date.
- Lists all published modules in order with:
  - Module title and description.
  - Completion status indicator: `locked`, `in_progress`, `completed`.
  - Lesson count and completed lesson count (e.g., "3 / 5 lessons").
  - Percentage progress bar per module.
- Overall course progress bar and percentage at the top.
- Clear visual distinction between locked modules (greyed out with lock icon), the current active module, and completed modules (checkmark).
- Clicking a locked module shows a tooltip: "Complete [prerequisite module name] to unlock this module."
- Clicking an unlocked module navigates to the module detail view.

### 4.2 Module Detail View

Shows all lessons within a module in sequence.

- Module title, description, and completion status.
- Ordered lesson list with:
  - Lesson title and type icon (book for reading, play button for video, pencil for quiz, clipboard for exam).
  - Completion status: `not_started`, `in_progress`, `completed`.
  - For quiz/exam lessons: score and attempt count (if attempted).
- A "Continue" button that navigates to the first incomplete lesson.
- Lessons are accessible in any order within an unlocked module (no intra-module locking).
- The module marks as completable only when all completion criteria from Module 3 are met.

### 4.3 Lesson Viewer — Reading

- Full-width reading area rendering the sanitized HTML content from the lesson document.
- Clean typography optimized for long-form reading (readable font size, comfortable line height, max content width).
- Estimated reading time displayed at the top (calculated from word count).
- A "Mark as completed" button at the bottom of the reading.
- Scrolling to the bottom enables the completion button (prevents accidental skip). Alternatively, the button is always enabled but the system records scroll depth.
- On completion, a `lessonProgress` record is created/updated (see Database Schema).

### 4.4 Lesson Viewer — Video

- Embedded video player using the HTML5 `<video>` element or a lightweight player library (e.g., Plyr, React Player).
- Video source loaded from the Firebase Storage signed URL stored in the lesson document.
- Player controls: play/pause, seek, volume, fullscreen, playback speed (0.5x, 1x, 1.25x, 1.5x, 2x).
- Video progress is tracked:
  - Last watched position is saved so the trainee can resume where they left off.
  - Completion threshold: video is marked as completed when the trainee has watched at least **90%** of the duration.
- On completion, a `lessonProgress` record is created/updated.
- Fallback message if video fails to load (with retry button).

### 4.5 Lesson Viewer — Quiz / Exam Shell

- For lessons of type `quiz` or `exam`, this module renders a container that mounts the quiz/exam component from Module 5.
- Passes the `quizId` from the lesson's content field to the quiz renderer.
- Displays lesson title and any instructions above the quiz component.
- After quiz/exam submission, the result is displayed inline and the lesson completion state updates.

### 4.6 Lesson Navigation

- **Previous / Next** buttons at the bottom of every lesson viewer to move between lessons in order within the module.
- "Previous" is disabled on the first lesson; "Next" is disabled on the last lesson.
- On the last lesson, the "Next" button changes to "Back to Module" which returns to the module detail view.
- A **lesson sidebar/drawer** (collapsible on mobile) shows all lessons in the current module with completion indicators, allowing direct navigation to any lesson.
- Keyboard navigation: left/right arrow keys for previous/next (optional enhancement).

### 4.7 Content Completion Tracking

Every time a trainee completes a lesson, the system:

1. Creates or updates a `lessonProgress` document in Firestore (via the API).
2. Recalculates the parent module's completion percentage.
3. Checks if the module's `completionCriteria` are now fully met.
4. If met, updates the module progress status to `completed` (handled by Module 6's progression engine, but triggered from here).

Completion rules by lesson type:

| Lesson Type | Completion trigger |
|---|---|
| Reading | Trainee clicks "Mark as completed" |
| Video | Trainee watches ≥ 90% of video duration |
| Quiz | Trainee submits the quiz (any score — practice quizzes don't block) |
| Exam | Trainee passes the exam (pass/fail determined by Module 5) |

### 4.8 Mobile-Responsive Design

- All learner pages are fully responsive: desktop, tablet (portrait/landscape), and phone.
- Video player scales to viewport width.
- Reading content reflows for narrow screens.
- Lesson sidebar collapses to a hamburger/drawer on mobile.
- Navigation buttons are touch-friendly (minimum 44px tap targets).
- Course dashboard uses a stacked card layout on mobile instead of a wide list.

### 4.9 Offline / Loading States

- Skeleton loaders while course, module, and lesson data is fetching.
- Error state with retry button if API calls fail.
- "No content available" empty state if a module has no published lessons (edge case for admin misconfiguration).
- Video buffering indicator during slow connections.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Video player | HTML5 `<video>` with Plyr or React Player wrapper |
| Video completion tracking | Client-side `timeupdate` event listener, debounced position save every 15 seconds |
| Video completion threshold | 90% of duration watched |
| Reading completion | Explicit "Mark as completed" click |
| Rich text rendering | `dangerouslySetInnerHTML` with DOMPurify sanitization on render (content already sanitized on save in Module 3) |
| Reading time estimate | ~200 words per minute |
| Responsive breakpoints | Mobile: < 640px, Tablet: 640–1024px, Desktop: > 1024px (Tailwind defaults) |
| Signed URL refresh | If video URL expires (403), client requests a fresh URL from the server and retries |

---

## Database Schema (Firestore)

### Collection: `lessonProgress`

One document per trainee per lesson. Tracks individual lesson completion.

```
lessonProgress/
  └── {lessonProgressId} (document)
        ├── lessonId: string
        ├── moduleId: string             // Denormalized
        ├── courseId: string             // Denormalized
        ├── traineeId: string            // User UID
        ├── status: string               // "not_started" | "in_progress" | "completed"
        ├── lessonType: string           // "reading" | "video" | "quiz" | "exam"
        ├── videoProgress: map | null    // For video lessons only
        │     ├── lastPosition: number   // Seconds
        │     ├── maxReached: number     // Furthest second watched
        │     └── percentWatched: number // 0–100
        ├── completedAt: timestamp | null
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

**Document ID convention:** `{traineeId}_{lessonId}` — ensures one record per trainee per lesson and enables efficient queries.

### Firestore Security Rules (Module 4 additions)

```javascript
// Lesson progress: trainee reads/writes own, admin reads all
match /lessonProgress/{progressId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.uid == resource.data.traineeId
  );
  allow write: if false; // managed via server API
}
```

---

## API Endpoints

### Trainee Course & Module Access

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/my/courses` | Trainee | Get the trainee's enrolled course(s) with overall progress summary. |
| `GET` | `/api/my/courses/:courseId` | Trainee | Full course view: all modules with order, status (locked/in_progress/completed), lesson counts, and progress percentages. |
| `GET` | `/api/my/courses/:courseId/modules/:moduleId` | Trainee | Module detail: all lessons with order, type, and completion status for the trainee. Validates module is unlocked for this trainee. |
| `GET` | `/api/my/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Trainee | Full lesson content. Returns reading HTML, video URL, or quiz reference depending on type. Validates module is unlocked. |

### Lesson Progress

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/my/progress/lessons/:lessonId/complete` | Trainee | Mark a reading lesson as completed. Server validates lesson type and enrollment. |
| `POST` | `/api/my/progress/lessons/:lessonId/video-progress` | Trainee | Save video watch position. Body: `{ lastPosition, maxReached, percentWatched }`. Auto-completes if ≥ 90%. |
| `GET` | `/api/my/progress/courses/:courseId` | Trainee | Get all lesson progress records for the trainee in this course (used to render status indicators). |

### Video URL Refresh

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/my/lessons/:lessonId/video-url` | Trainee | Returns a fresh signed download URL for the lesson's video. Used when the cached URL expires. |

### Admin Content Preview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/lessons/:lessonId/preview` | Admin | Returns lesson content regardless of publish status. Used by the CMS preview feature from Module 3. |

---

## UI Components

### Pages

| Component | Route | Role | Purpose |
|---|---|---|---|
| `TraineeCourseDashboard` | `/dashboard` | Trainee | Course overview with module cards, progress bars, due date |
| `ModuleDetailPage` | `/courses/:courseId/modules/:moduleId` | Trainee | Lesson list with status, continue button |
| `LessonViewerPage` | `/courses/:courseId/modules/:moduleId/lessons/:lessonId` | Trainee | Renders the appropriate lesson content based on type |

### Lesson Type Renderers

| Component | Purpose |
|---|---|
| `ReadingViewer` | Renders sanitized HTML reading content with estimated reading time and "Mark as completed" button |
| `VideoViewer` | Video player with progress tracking, resume, speed controls, and auto-completion at 90% |
| `QuizExamShell` | Container that mounts the quiz/exam component from Module 5 by `quizId` |

### Navigation & Layout

| Component | Purpose |
|---|---|
| `LessonSidebar` | Collapsible sidebar listing all lessons in the current module with completion indicators and direct links |
| `LessonNavigation` | Previous / Next buttons at the bottom of the lesson viewer |
| `ModuleCard` | Card component for the course dashboard showing module title, progress bar, status, lesson count |
| `CourseProgressBar` | Top-level progress bar with percentage for the entire course |
| `ModuleProgressBar` | Progress bar for an individual module |

### Status & Feedback

| Component | Purpose |
|---|---|
| `LockOverlay` | Overlay on locked module cards with lock icon and prerequisite message |
| `CompletionBadge` | Checkmark badge for completed lessons/modules |
| `LessonTypeIcon` | Icon component returning the correct icon for reading/video/quiz/exam |
| `VideoBufferingIndicator` | Spinner overlay shown while video is loading/buffering |
| `ContentErrorState` | Error display with retry button for failed content loads |
| `ContentEmptyState` | "No content available" message for edge cases |
| `SkeletonLoader` | Animated placeholder shown while content is loading (variants for course dashboard, module list, lesson content) |
| `DueDateBanner` | Banner at top of dashboard showing course due date with urgency color (green → amber → red as due date approaches) |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Trainee sees their enrolled course on the dashboard with all 6 modules listed in correct order. | Manual test |
| 2 | Locked modules are visually distinct and show a prerequisite message on click. | Manual test |
| 3 | Trainee can open an unlocked module and see all lessons in order with type icons. | Manual test |
| 4 | Reading content renders correctly with formatting (headings, bold, lists, links). | Manual test |
| 5 | "Mark as completed" on a reading updates the lesson status to `completed`. | Automated test |
| 6 | Video plays from Firebase Storage signed URL with all player controls functional. | Manual test |
| 7 | Video resume works: closing and reopening a video resumes from the last saved position. | Manual test |
| 8 | Video auto-completes when ≥ 90% of duration is watched. | Automated test |
| 9 | Previous/Next navigation moves between lessons in correct order. | Manual test |
| 10 | Lesson sidebar shows completion status and allows direct navigation to any lesson in the module. | Manual test |
| 11 | Module progress bar updates in real time as lessons are completed. | Manual test |
| 12 | Course progress bar on the dashboard reflects aggregate module completion. | Manual test |
| 13 | All learner pages render correctly on mobile (phone width, 375px). | Manual test (device/emulator) |
| 14 | All learner pages render correctly on tablet (768px). | Manual test (device/emulator) |
| 15 | Expired video URL triggers a refresh and video loads successfully on retry. | Automated test |
| 16 | API returns `403` if trainee tries to access a lesson in a locked module. | Automated test |

---

## Integration Points with Other Modules

| Target Module | What this module provides |
|---|---|
| Module 5 (Quiz Engine) | `QuizExamShell` container that mounts the quiz/exam renderer; lesson navigation context so quiz results feed back into lesson completion |
| Module 6 (Progress Tracking) | `lessonProgress` records created on every lesson completion; video progress data; completion events that trigger module-level recalculation and unlock checks |
| Module 7 (Dashboard) | `lessonProgress` collection provides per-trainee completion data that powers admin reporting |
| Module 8 (Reminders) | Lesson and module progress data determines whether a trainee is "incomplete" relative to the course due date |
