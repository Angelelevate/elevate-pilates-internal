# Module 5: Quiz & Exam Engine

## Goal

Build the assessment system that powers both practice quizzes (low-stakes checkpoint knowledge checks) and formal exams (high-stakes gated assessments that control module progression). This module covers quiz/exam authoring for admins, the trainee-facing quiz renderer, grading logic, attempt tracking, pass/fail thresholds, and the retake policy (3 total attempts per exam).

## Dependencies

- **Module 1** — Firestore connection, Express scaffold.
- **Module 2** — Authentication, role middleware, trainee identity.
- **Module 3** — Lesson records of type `quiz`/`exam` reference quiz definitions created here; `QuizSelector` component in the CMS consumes the quiz list.
- **Module 4** — `QuizExamShell` container renders the quiz/exam component; lesson completion events feed quiz results into progress tracking.

## Depended on by

- **Module 6** (Progress Tracking) — exam pass/fail status is the core unlock gate for module progression.
- **Module 7** (Dashboard) — attempt history, scores, and pass rates feed admin reporting.

---

## Detailed Features

### 5.1 Assessment Types

Two assessment types sharing the same engine but with different behavior:

| Aspect | Quiz (practice/checkpoint) | Exam (formal/graded) |
|---|---|---|
| Purpose | Knowledge check, learning reinforcement | Gated assessment controlling progression |
| Grading mode | Instant — show result after each question or after submission | End-of-assessment — show result only after full submission |
| Passing threshold | None — any score is acceptable | Configurable pass mark (e.g., 70%) |
| Retakes | Unlimited | 3 total attempts (1 initial + 2 retakes) |
| Impact on progression | Submitting the quiz marks the lesson as completed regardless of score | Passing the exam is required to satisfy module completion criteria |
| Question order | Fixed or shuffled (configurable) | Shuffled recommended to reduce memorization across retakes |
| Time limit | None | Optional (configurable by admin) |

### 5.2 Question Types

All question types are supported in both quizzes and exams.

**MCQ (Multiple Choice — single correct answer)**
- Question text.
- 2–6 answer options.
- Exactly one option marked as correct.
- Optional explanation text shown after answering (quiz mode) or after submission (exam mode).

**True / False**
- Question text.
- Two options: True and False.
- One correct answer.
- Optional explanation text.

**Multi-Select (Multiple correct answers)**
- Question text.
- 2–6 answer options.
- One or more options marked as correct.
- Scoring: full marks only if all correct options are selected and no incorrect options are selected (no partial credit in MVP).
- Optional explanation text.

### 5.3 Quiz / Exam Authoring (Admin)

- Admin creates a quiz or exam from the CMS (accessed via Module 3's `QuizSelector` or directly from a quiz management page).
- Authoring form includes:
  - Title and description/instructions.
  - Assessment type: `quiz` or `exam`.
  - Pass mark percentage (exam only, default 70%).
  - Time limit in minutes (exam only, optional).
  - Question order: `fixed` or `shuffled`.
  - Option order within questions: `fixed` or `shuffled`.
- Admin adds questions one at a time:
  - Select question type (MCQ, true/false, multi-select).
  - Enter question text (supports basic formatting: bold, italic, code).
  - Add answer options with correct answer(s) flagged.
  - Add optional explanation text.
  - Set point value (default 1 per question).
  - Reorder questions via drag-and-drop.
- Admin can preview the quiz/exam as the trainee would see it.
- Quiz/exam has its own `status`: `draft` or `published`. Must be published before the linked lesson can be published.

### 5.4 Trainee Quiz Experience (Instant Grading)

For quizzes (practice/checkpoint):

- Trainee opens the lesson containing the quiz.
- All questions are displayed on a single page (scrollable) or paginated (one per page) — admin configurable, default: single page.
- Trainee selects answers and clicks "Submit Quiz."
- On submission:
  - All answers are graded instantly.
  - Results screen shows: total score, per-question result (correct/incorrect), correct answers, and explanations.
  - The lesson is marked as `completed` regardless of score.
- Trainee can retake the quiz unlimited times (each attempt is recorded).

### 5.5 Trainee Exam Experience (End-of-Assessment Grading)

For exams (formal/graded):

- Trainee opens the lesson containing the exam.
- If a time limit is set, a countdown timer is displayed prominently.
- Questions are displayed one per page with a progress indicator ("Question 3 of 20").
- A question navigator panel shows answered/unanswered status.
- Trainee cannot see correct answers during the exam.
- "Submit Exam" button is available at any time; a confirmation dialog warns about unanswered questions.
- If the time limit expires, the exam auto-submits with whatever answers are recorded.
- On submission:
  - Server grades all answers and calculates the score.
  - Result screen shows: total score, pass/fail status, and pass mark threshold.
  - Per-question breakdown is shown (correct/incorrect and explanations) only after submission.
  - If passed: lesson status is `completed`, and the result feeds into Module 6 progression logic.
  - If failed: remaining attempts are displayed (e.g., "1 retake remaining"). The retake button is available immediately (no cooldown in MVP).

### 5.6 Retake Policy (Exams Only)

- Maximum **3 total attempts** per exam per trainee (1 initial + 2 retakes).
- Each attempt is a separate `quizAttempt` document recording all answers and the score.
- After 3 failed attempts, the exam is locked with a message: "Maximum attempts reached. Contact your admin."
- **Admin can reset attempts** for a trainee on a specific exam (sets attempts back to 0), enabling the trainee to try again. This is a deliberate admin override for edge cases.
- The highest score across all attempts is used as the trainee's result for reporting purposes.
- The pass/fail status is based on the most recent passing attempt (if any).

### 5.7 Attempt Tracking

Every quiz/exam submission creates an `quizAttempt` record:

- All selected answers stored.
- Score calculated and stored.
- Pass/fail status (for exams).
- Time taken (start to submit).
- Timestamp.

Admin can view all attempts for any trainee on any quiz/exam in the admin dashboard (Module 7).

### 5.8 Anti-Skip Safeguards

- Exam questions with `shuffled` order get a different sequence per attempt.
- Answer option order is shuffled per attempt if configured.
- Trainee cannot navigate back to a submitted exam to change answers (immutable after submission).
- Timer-based exams cannot be paused or extended by the trainee.

---

## Technical Requirements

| Requirement | Detail |
|---|---|
| Grading | Server-side grading only — correct answers are never sent to the client before submission |
| Shuffling | Server generates shuffled order per attempt using a seeded random (attempt ID as seed for reproducibility) |
| Timer | Client-side countdown synced with server-recorded start time; auto-submit calls the server on expiry |
| Point values | Integer points per question; total score = sum of earned points / sum of possible points × 100 |
| Partial credit | Not supported in MVP (multi-select is all-or-nothing) |
| Answer storage | Selected option IDs stored per question per attempt |
| Question text | Supports basic inline formatting (bold, italic, inline code) via Markdown or limited HTML |

---

## Database Schema (Firestore)

### Collection: `quizzes`

One document per quiz or exam definition.

```
quizzes/
  └── {quizId} (document)
        ├── title: string
        ├── description: string          // Instructions shown before start
        ├── type: string                 // "quiz" | "exam"
        ├── courseId: string             // Parent course reference
        ├── passMark: number | null      // Percentage (e.g., 70). Null for quizzes.
        ├── timeLimitMinutes: number | null  // Null = no time limit
        ├── questionOrder: string        // "fixed" | "shuffled"
        ├── optionOrder: string          // "fixed" | "shuffled"
        ├── displayMode: string          // "single_page" | "one_per_page"
        ├── totalPoints: number          // Sum of all question points (auto-calculated)
        ├── questionCount: number        // Count of questions (auto-calculated)
        ├── status: string               // "draft" | "published"
        ├── createdBy: string            // Admin UID
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Collection: `questions`

One document per question belonging to a quiz/exam.

```
questions/
  └── {questionId} (document)
        ├── quizId: string               // Parent quiz reference
        ├── type: string                 // "mcq" | "true_false" | "multi_select"
        ├── text: string                 // Question text (supports basic formatting)
        ├── options: array
        │     └── [
        │           {
        │             id: string,        // Unique option ID (UUID)
        │             text: string,
        │             isCorrect: boolean  // NEVER sent to client during active attempt
        │           }
        │         ]
        ├── explanation: string | null   // Shown after grading
        ├── points: number               // Default 1
        ├── order: number                // Sequence within the quiz
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Collection: `quizAttempts`

One document per attempt by a trainee on a quiz/exam.

```
quizAttempts/
  └── {attemptId} (document)
        ├── quizId: string
        ├── lessonId: string             // The lesson that contains this quiz/exam
        ├── moduleId: string             // Denormalized
        ├── courseId: string             // Denormalized
        ├── traineeId: string            // User UID
        ├── attemptNumber: number        // 1, 2, or 3
        ├── status: string               // "in_progress" | "submitted" | "timed_out"
        ├── answers: array
        │     └── [
        │           {
        │             questionId: string,
        │             selectedOptionIds: array<string>,  // One for MCQ/TF, multiple for multi-select
        │             isCorrect: boolean,                // Set by server after grading
        │             pointsEarned: number
        │           }
        │         ]
        ├── questionOrder: array<string> // Ordered question IDs for this attempt (shuffled or fixed)
        ├── score: number | null         // Percentage (0–100), set after grading
        ├── pointsEarned: number | null  // Raw points earned
        ├── totalPoints: number          // Max possible points
        ├── passed: boolean | null       // For exams: score >= passMark. Null for quizzes.
        ├── timeLimitMinutes: number | null
        ├── startedAt: timestamp
        ├── submittedAt: timestamp | null
        ├── durationSeconds: number | null  // submittedAt - startedAt
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```

### Firestore Security Rules (Module 5 additions)

```javascript
// Quizzes: admin full read, trainees read published only (questions excluded — fetched via API)
match /quizzes/{quizId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    (request.auth.token.role == 'trainee' && resource.data.status == 'published')
  );
  allow write: if false;
}

// Questions: no direct client reads (served via API to strip correct answers)
match /questions/{questionId} {
  allow read: if request.auth != null && request.auth.token.role == 'admin';
  allow write: if false;
}

// Quiz attempts: trainee reads own, admin reads all
match /quizAttempts/{attemptId} {
  allow read: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.uid == resource.data.traineeId
  );
  allow write: if false;
}
```

---

## API Endpoints

### Quiz / Exam Authoring (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/quizzes` | Admin | Create a quiz or exam. Body: `{ title, description, type, courseId, passMark?, timeLimitMinutes?, questionOrder, optionOrder, displayMode }` |
| `GET` | `/api/quizzes` | Admin | List all quizzes/exams. Filterable by courseId, type, status. |
| `GET` | `/api/quizzes/:quizId` | Admin | Get quiz/exam detail with full question list (including correct answers). |
| `PATCH` | `/api/quizzes/:quizId` | Admin | Update quiz/exam settings. |
| `PATCH` | `/api/quizzes/:quizId/status` | Admin | Publish or unpublish a quiz/exam. |
| `DELETE` | `/api/quizzes/:quizId` | Admin | Archive a quiz/exam (soft delete). |

### Question Management (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/quizzes/:quizId/questions` | Admin | Add a question. Body: `{ type, text, options, explanation?, points?, order }` |
| `GET` | `/api/quizzes/:quizId/questions` | Admin | List all questions for a quiz (with correct answers). |
| `PATCH` | `/api/questions/:questionId` | Admin | Update a question. |
| `PATCH` | `/api/quizzes/:quizId/questions/reorder` | Admin | Reorder questions. Body: `{ orderedQuestionIds: [...] }` |
| `DELETE` | `/api/questions/:questionId` | Admin | Remove a question from a quiz. |

### Trainee Quiz/Exam Taking

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/my/quizzes/:quizId/attempts` | Trainee | Start a new attempt. Server validates retake limit (for exams). Returns attempt ID, questions (without correct answers), and shuffled order. |
| `GET` | `/api/my/attempts/:attemptId` | Trainee | Get attempt details. If `in_progress`: returns questions without correct answers. If `submitted`: returns full results with correct answers and explanations. |
| `POST` | `/api/my/attempts/:attemptId/submit` | Trainee | Submit answers. Body: `{ answers: [{ questionId, selectedOptionIds }] }`. Server grades, calculates score, returns results. |
| `GET` | `/api/my/quizzes/:quizId/attempts` | Trainee | List own attempts for a quiz/exam (attempt number, score, pass/fail, timestamp). |

### Admin Attempt Management

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/quizzes/:quizId/attempts` | Admin | List all attempts across all trainees for a quiz/exam. Filterable by traineeId. |
| `GET` | `/api/admin/attempts/:attemptId` | Admin | Full attempt detail including all answers and grading. |
| `POST` | `/api/admin/quizzes/:quizId/trainees/:traineeId/reset-attempts` | Admin | Reset all attempts for a trainee on a specific exam. Deletes existing attempt records and resets count. |

### Quiz Preview (Admin)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/quizzes/:quizId/preview` | Admin | Returns quiz with questions in trainee-facing format (no correct answers) for preview purposes. |

---

## UI Components

### Admin Pages

| Component | Route | Role | Purpose |
|---|---|---|---|
| `QuizListPage` | `/admin/quizzes` | Admin | Table of all quizzes/exams with type, question count, status, linked lesson info |
| `QuizEditorPage` | `/admin/quizzes/:quizId` | Admin | Quiz settings form + question list with add/edit/reorder/delete |
| `QuestionEditorModal` | (modal on QuizEditorPage) | Admin | Form to create/edit a question: type selector, text input, options builder, correct answer toggle, explanation, points |
| `QuizPreviewModal` | (modal on QuizEditorPage) | Admin | Renders the quiz as a trainee would see it |
| `AttemptReviewPage` | `/admin/attempts/:attemptId` | Admin | Detailed view of a trainee's attempt: each question, selected answer, correct answer, points |

### Admin Components

| Component | Purpose |
|---|---|
| `QuestionTypeSelector` | Dropdown/button group to choose MCQ, True/False, or Multi-Select |
| `OptionBuilder` | Dynamic list of answer options with add/remove, text input, and "correct" toggle per option |
| `QuizSettingsForm` | Form for quiz metadata: type, pass mark, time limit, question/option order, display mode |
| `QuestionCard` | Displays a question in the editor with type badge, preview, points, drag handle for reorder |
| `QuizSelector` | Dropdown to link a published quiz/exam to a lesson (used in Module 3's LessonEditorPage) |
| `ResetAttemptsButton` | Button (with confirmation dialog) to reset a trainee's exam attempts |

### Trainee Pages / Components

| Component | Purpose |
|---|---|
| `QuizRenderer` | Main component mounted inside Module 4's `QuizExamShell`. Handles both quiz and exam flows based on type. |
| `QuestionDisplay` | Renders a single question with answer options (radio for MCQ/TF, checkbox for multi-select) |
| `AnswerOption` | Individual option: radio button or checkbox with label text |
| `QuizProgressBar` | Shows "Question X of Y" and answered/unanswered count |
| `QuestionNavigator` | Panel showing all question numbers; colored by answered/unanswered status. Clickable to jump to a question (exam one-per-page mode). |
| `ExamTimer` | Countdown timer displayed during timed exams. Changes color when < 5 minutes remain. Auto-submits on expiry. |
| `SubmitConfirmationDialog` | Dialog warning about unanswered questions before final submission |
| `QuizResultsScreen` | Post-submission results: score, pass/fail badge, per-question breakdown with correct answers and explanations |
| `ExamLockedMessage` | Shown when max attempts reached: "Maximum attempts reached. Contact your admin." |
| `RetakePrompt` | Shown after failed exam: score, remaining attempts count, "Retake Exam" button |
| `AttemptHistoryList` | List of previous attempts with attempt number, score, pass/fail, and date |

---

## Success Criteria

| # | Criterion | Verification |
|---|---|---|
| 1 | Admin can create a quiz with MCQ, true/false, and multi-select questions. | Manual test |
| 2 | Admin can create an exam with a pass mark, time limit, and shuffled question order. | Manual test |
| 3 | Admin can reorder questions within a quiz/exam. | Manual test |
| 4 | Correct answers are never sent to the client during an active attempt (verified via network inspection). | Automated test |
| 5 | Trainee can take a practice quiz; results show instantly after submission with correct answers and explanations. | Manual test |
| 6 | Trainee can take a timed exam; timer counts down and auto-submits on expiry. | Manual test |
| 7 | Exam grading correctly calculates score as percentage; pass/fail matches the configured pass mark. | Automated test |
| 8 | After a failed exam, trainee sees remaining attempts and can retake. | Manual test |
| 9 | After 3 failed exam attempts, the exam is locked and shows the locked message. | Automated test |
| 10 | Admin can reset a trainee's exam attempts; trainee can then retake the exam. | Manual test |
| 11 | Shuffled question and option order produces a different sequence per attempt. | Automated test |
| 12 | Multi-select scoring is all-or-nothing: full points only when all correct and no incorrect options are selected. | Automated test |
| 13 | Each attempt is recorded with full answer details, score, and timestamp. | Automated test |
| 14 | Admin can view any trainee's attempt history and per-question answers. | Manual test |
| 15 | Quiz submission marks the linked lesson as `completed` regardless of score. | Automated test |
| 16 | Exam pass marks the linked lesson as `completed`; exam fail does not. | Automated test |

---

## Integration Points with Other Modules

| Target Module | What this module provides |
|---|---|
| Module 3 (CMS) | `QuizSelector` component that lists published quizzes/exams for linking to lessons; quiz `status` used in lesson publish validation |
| Module 4 (Content Delivery) | `QuizRenderer` component mounted inside `QuizExamShell`; quiz/exam results update lesson completion status |
| Module 6 (Progress Tracking) | Exam pass/fail status is the core unlock gate — Module 6 queries `quizAttempts` to determine if the module exam has been passed |
| Module 7 (Dashboard) | `quizAttempts` collection provides attempt history, scores, and pass rates for admin reporting |
