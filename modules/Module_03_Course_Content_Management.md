# Module 3: Course & Content Management (Admin CMS)

## Goal

Deliver a unified custom CMS that allows admins to create, edit, publish, and archive courses, modules, and all learning content (readings, videos, quizzes, exams) without developer involvement. This module defines the full content data model and hierarchy, the admin-facing CRUD interface, the draft/publish workflow, and the course-to-trainee assignment mechanism.

## Dependencies

- **Module 1** — Firestore connection, Express route scaffold, React app shell, Firebase Storage configured.
- **Module 2** — Admin authentication, `requireAuth` + `requireRole('admin')` middleware, `users` collection.

## Depended on by

- **Module 4** (Content Delivery) — reads published courses, modules, and lesson content for trainee consumption.
- **Module 5** (Quiz Engine) — reads quiz/exam definitions created here.
- **Module 6** (Progress Tracking) — reads module structure and completion rules defined here.
- **Module 7** (Dashboard) — reads course/module metadata for reporting context.
- **Module 8** (Reminders) — reads course due dates and enrollment data.

---

## Detailed Features

### 3.1 Content Hierarchy

The platform follows a strict four-level hierarchy:

```
Course
  └── Module (ordered, 1–N per course)
        └── Lesson (ordered, 1–N per module)
              └── Content items within a lesson:
                    - Reading (rich text)
                    - Video (Firebase Storage reference)
                    - Quiz (practice/checkpoint — defined in Module 5)
                    - Exam (formal graded — defined in Module 5)
```

- A **course** is the top-level container. MVP has one course.
- A **module** is a sequenced unit within a course (e.g., "Module 01: Orientation"). Modules have an explicit `order` field controlling sequence.
- A **lesson** is a single learning unit within a module (e.g., "Welcome Video", "Core Principles Reading"). Lessons have an explicit `order` field.
- Each lesson has a `type` that determines what content it holds: `reading`, `video`, `quiz`, or `exam`.

### 3.2 Course Management

- Admin can **create** a new course with: title, description, thumbnail (optional), due date, and status.
- Admin can **edit** course metadata at any time.
- Admin can **archive** a course (soft delete — removes from active views but retains data).
- Architecture supports multiple courses for future expansion, but MVP configures one.

### 3.3 Module Management

- Admin can **add modules** to a course, setting title, description, order, and prerequisite rules.
- Admin can **reorder modules** via drag-and-drop or explicit order field editing.
- Admin can **edit** or **delete** modules.
- Each module has a `completionCriteria` field defining what a trainee must accomplish to mark the module as complete:
  - `allLessonsCompleted` — all lessons must be viewed/completed.
  - `examPassed` — the module's exam (if any) must be passed.
  - MVP default: both conditions must be met if the module contains an exam; otherwise `allLessonsCompleted` only.

### 3.4 Lesson Management

- Admin can **add lessons** to a module, choosing the lesson type: `reading`, `video`, `quiz`, or `exam`.
- Admin can **reorder lessons** within a module.
- Admin can **edit** or **delete** lessons.
- Each lesson type has its own content payload:
  - **Reading**: rich text content (stored as HTML or Markdown).
  - **Video**: upload a video file to Firebase Storage, or provide a direct URL. Stores file reference, duration (if available), and display title.
  - **Quiz / Exam**: links to a quiz definition (created and managed in Module 5). The lesson record holds a reference to the quiz/exam document.

### 3.5 Video Upload

- Admin uploads video files through the CMS.
- Server handles upload to Firebase Storage under the path: `videos/{courseId}/{moduleId}/{filename}`.
- Supported formats: MP4, MOV, WEBM.
- Max file size: configurable (default 500 MB).
- After upload, server stores the Storage file path and a signed download URL in the lesson document.
- Admin can replace or remove a video from a lesson.

### 3.6 Rich Text Editor for Readings

- CMS provides a rich text editor (e.g., TipTap, React Quill, or similar) for authoring reading content.
- Supported formatting: headings, bold, italic, lists (ordered/unordered), links, images (inline upload to Storage), block quotes.
- Content stored as sanitized HTML in Firestore.
- Admin can preview the reading as the trainee would see it.

### 3.7 Draft / Publish Workflow

Every course, module, and lesson has a `status` field:

| Status | Meaning |
|---|---|
| `draft` | Work in progress. Not visible to trainees. |
| `published` | Live and visible to enrolled trainees. |
| `archived` | Soft-deleted. Hidden from all views but retained in database. |

- New content is created in `draft` status by default.
- Admin explicitly publishes when content is ready.
- Publishing a course requires all its modules and lessons to be in a publishable state (no empty modules, no lessons missing content).
- Admin can unpublish (revert to draft) at any time; enrolled trainees see a "content temporarily unavailable" message for unpublished items.

### 3.8 Course Assignment (Enrollment)

- Admin assigns a published course to one or more trainees.
- Assignment creates an **enrollment** record linking the trainee to the course.
- Enrollment can also happen automatically on invite acceptance (admin selects the course during invite creation).
- Admin can view and manage enrollments from the course detail page.
- Admin can unenroll a trainee (soft removal — enrollment status set to `withdrawn`).
- Each enrollment has a **due date** (inherited from the course due date by default, overridable per enrollment).

### 3.9 Content Validation

Before publishing, the system validates:

- Course has at least one module.
- Every module has at least one lesson.
- Every lesson has content (reading text is not empty, video reference exists, quiz/exam reference exists).
- Module order has no gaps or duplicates.
- Lesson order within each module has no gaps or duplicates.

Validation errors are shown in the CMS with specific messages pointing to the incomplete items.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Rich text editor | TipTap, React Quill, or equivalent (lightweight, extensible) |
| Video upload | Multipart upload to Express, streamed to Firebase Storage via Admin SDK |
| Max video size | 500 MB (configurable in `systemConfig`) |
| Supported video formats | MP4, MOV, WEBM |
| Content sanitization | DOMPurify or equivalent for HTML reading content before storage |
| Ordering | Integer-based `order` field; reorder operations update affected documents in a batch |
| Soft delete | Archived records remain in Firestore; queries filter by `status != 'archived'` |

---

## Database Schema (Firestore)

### Collection: `courses`

```
courses/
  └── {courseId} (document)
        ├── title: string
        ├── description: string
        ├── thumbnailUrl: string | null
        ├── status: string               // "draft" | "published" | "archived"
        ├── dueDate: timestamp | null     // Course-level due date
        ├── createdBy: string             // Admin UID
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Collection: `modules`

```
modules/
  └── {moduleId} (document)
        ├── courseId: string              // Reference to parent course
        ├── title: string
        ├── description: string
        ├── order: number                 // 1-based sequence within the course
        ├── completionCriteria: map
        │     ├── allLessonsCompleted: boolean   // true
        │     └── examPassed: boolean            // true if module has an exam
        ├── status: string               // "draft" | "published" | "archived"
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Collection: `lessons`

```
lessons/
  └── {lessonId} (document)
        ├── moduleId: string             // Reference to parent module
        ├── courseId: string             // Denormalized for query convenience
        ├── title: string
        ├── type: string                 // "reading" | "video" | "quiz" | "exam"
        ├── order: number                // 1-based sequence within the module
        ├── content: map                 // Type-specific payload (see below)
        ├── status: string               // "draft" | "published" | "archived"
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

**Content map by lesson type:**

```
// type: "reading"
content: {
  body: string              // Sanitized HTML
}

// type: "video"
content: {
  storagePath: string       // Firebase Storage path
  downloadUrl: string       // Signed URL (refreshed periodically)
  fileName: string
  mimeType: string          // "video/mp4", etc.
  durationSeconds: number | null
}

// type: "quiz" or "exam"
content: {
  quizId: string            // Reference to quiz document (Module 5)
}
```

### Collection: `enrollments`

```
enrollments/
  └── {enrollmentId} (document)
        ├── courseId: string
        ├── traineeId: string            // User UID
        ├── status: string               // "active" | "completed" | "withdrawn"
        ├── dueDate: timestamp | null     // Inherited from course or overridden
        ├── enrolledBy: string           // Admin UID who assigned the course
        ├── enrolledAt: timestamp
        ├── completedAt: timestamp | null
        └── updatedAt: timestamp
```

### Firestore Security Rules (Module 3 additions)

```javascript
// Courses: admin full read, trainees read published only
match /courses/{courseId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    (request.auth.token.role == 'trainee' && resource.data.status == 'published')
  );
  allow write: if false; // managed via Admin SDK
}

// Modules: same pattern as courses
match /modules/{moduleId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    (request.auth.token.role == 'trainee' && resource.data.status == 'published')
  );
  allow write: if false;
}

// Lessons: same pattern as courses
match /lessons/{lessonId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    (request.auth.token.role == 'trainee' && resource.data.status == 'published')
  );
  allow write: if false;
}

// Enrollments: admin reads all, trainee reads own
match /enrollments/{enrollmentId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.uid == resource.data.traineeId
  );
  allow write: if false;
}
```

---

## API Endpoints

All endpoints prefixed with `/api`. Admin endpoints require `requireAuth` + `requireRole('admin')`.

### Courses

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/courses` | Admin | Create a new course. Body: `{ title, description, thumbnailUrl?, dueDate? }` |
| `GET` | `/api/courses` | Admin | List all courses (filterable by status). |
| `GET` | `/api/courses/:courseId` | Admin | Get full course detail including module count summary. |
| `PATCH` | `/api/courses/:courseId` | Admin | Update course metadata. |
| `PATCH` | `/api/courses/:courseId/status` | Admin | Change status (publish, unpublish, archive). Runs validation before publish. |

### Modules

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/courses/:courseId/modules` | Admin | Add a module to a course. Body: `{ title, description, order, completionCriteria? }` |
| `GET` | `/api/courses/:courseId/modules` | Admin | List all modules for a course, ordered by `order`. |
| `GET` | `/api/modules/:moduleId` | Admin | Get module detail with lesson count summary. |
| `PATCH` | `/api/modules/:moduleId` | Admin | Update module metadata. |
| `PATCH` | `/api/modules/:moduleId/status` | Admin | Publish, unpublish, or archive a module. |
| `PATCH` | `/api/courses/:courseId/modules/reorder` | Admin | Reorder modules. Body: `{ orderedModuleIds: [...] }` |
| `DELETE` | `/api/modules/:moduleId` | Admin | Archive a module (soft delete). |

### Lessons

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/modules/:moduleId/lessons` | Admin | Add a lesson. Body: `{ title, type, order, content? }` |
| `GET` | `/api/modules/:moduleId/lessons` | Admin | List all lessons for a module, ordered. |
| `GET` | `/api/lessons/:lessonId` | Admin | Get lesson detail with full content. |
| `PATCH` | `/api/lessons/:lessonId` | Admin | Update lesson metadata or content. |
| `PATCH` | `/api/lessons/:lessonId/status` | Admin | Publish, unpublish, or archive a lesson. |
| `PATCH` | `/api/modules/:moduleId/lessons/reorder` | Admin | Reorder lessons. Body: `{ orderedLessonIds: [...] }` |
| `DELETE` | `/api/lessons/:lessonId` | Admin | Archive a lesson (soft delete). |

### Video Upload

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/lessons/:lessonId/upload-video` | Admin | Upload a video file. Multipart form data. Stores to Firebase Storage, updates lesson content. |
| `DELETE` | `/api/lessons/:lessonId/video` | Admin | Remove video from lesson and optionally delete from Storage. |

### Enrollments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/courses/:courseId/enrollments` | Admin | Enroll one or more trainees. Body: `{ traineeIds: [...], dueDate? }` |
| `GET` | `/api/courses/:courseId/enrollments` | Admin | List all enrollments for a course with trainee info and status. |
| `PATCH` | `/api/enrollments/:enrollmentId` | Admin | Update enrollment (change due date, withdraw trainee). |
| `GET` | `/api/my/enrollments` | Trainee | Get the current trainee's enrollment(s). Returns course metadata and enrollment status. |

### Content Validation

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/courses/:courseId/validate` | Admin | Run publish-readiness validation. Returns list of issues (if any) or `{ valid: true }`. |

---

## UI Components

### Pages

| Component | Route | Role | Purpose |
|---|---|---|---|
| `CourseListPage` | `/admin/courses` | Admin | Table of all courses with status badges, create button |
| `CourseDetailPage` | `/admin/courses/:courseId` | Admin | Course metadata form + module list + enrollment summary + publish controls |
| `ModuleDetailPage` | `/admin/courses/:courseId/modules/:moduleId` | Admin | Module metadata form + lesson list + reorder + status controls |
| `LessonEditorPage` | `/admin/lessons/:lessonId` | Admin | Type-specific editor: rich text for readings, upload for videos, quiz selector for quizzes/exams |
| `EnrollmentManagementPanel` | (panel on CourseDetailPage) | Admin | Trainee enrollment list, add/remove trainees, set due dates |

### Shared Components

| Component | Purpose |
|---|---|
| `ContentHierarchyBreadcrumb` | Breadcrumb navigation: Course > Module > Lesson |
| `StatusBadge` | Visual badge for draft / published / archived |
| `PublishButton` | Triggers validation and publish flow with confirmation dialog |
| `DraftBanner` | Yellow banner shown on draft content: "This content is in draft and not visible to trainees" |
| `ModuleCard` | Card displaying module title, lesson count, status, order handle for drag-and-drop |
| `LessonRow` | Row in lesson list showing title, type icon, status, order handle |
| `DragDropList` | Reusable drag-and-drop wrapper for reordering modules or lessons |
| `RichTextEditor` | TipTap/Quill wrapper for reading content authoring |
| `VideoUploader` | Upload component with progress bar, preview, replace/remove actions |
| `QuizSelector` | Dropdown to link a quiz/exam definition to a lesson (populated from Module 5 data) |
| `ValidationResultsPanel` | Displays publish-readiness validation errors with links to fix them |
| `EnrollTraineeModal` | Modal to select trainees (from user list) and assign to course with optional due date |
| `CourseDueDatePicker` | Date picker for course-level due date |
| `ContentPreviewModal` | Preview how reading/video content appears to the trainee |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Admin can create a course with title, description, and due date. | Manual test |
| 2 | Admin can add 6 modules to a course and reorder them. | Manual test |
| 3 | Admin can add lessons of each type (reading, video, quiz, exam) to a module. | Manual test |
| 4 | Rich text editor saves and displays formatted reading content correctly. | Manual test |
| 5 | Video upload to Firebase Storage succeeds; video is playable from stored URL. | Manual test |
| 6 | Draft content is not visible to trainees via API or UI. | Automated test |
| 7 | Publish validation catches incomplete modules and lessons with actionable error messages. | Automated test |
| 8 | Admin can publish a fully configured course; status changes to `published` across course, modules, and lessons. | Manual test |
| 9 | Admin can enroll trainees in a course; enrollment record is created in Firestore. | Automated test |
| 10 | Trainee's enrollment endpoint returns their assigned course. | Automated test |
| 11 | Admin can unenroll (withdraw) a trainee; enrollment status changes to `withdrawn`. | Manual test |
| 12 | Content hierarchy is enforced: lessons belong to modules, modules belong to courses. | Automated test |
| 13 | Archiving a course/module/lesson hides it from active views but retains data. | Automated test |
| 14 | Module and lesson ordering is persisted and returned in correct sequence. | Automated test |

---

## Integration Points with Other Modules

| Target Module | What this module provides |
|---|---|
| Module 4 (Content Delivery) | Published courses, modules, and lessons with content payloads; enrollment data to verify trainee access |
| Module 5 (Quiz Engine) | Lesson records of type `quiz`/`exam` reference quiz definitions; `QuizSelector` component consumes quiz list from Module 5 |
| Module 6 (Progress Tracking) | Module `completionCriteria` field drives unlock logic; ordered module/lesson structure defines the progression path |
| Module 7 (Dashboard) | Course and enrollment metadata for reporting context; module structure for per-module completion views |
| Module 8 (Reminders) | Enrollment `dueDate` field is the trigger for reminder automation |
