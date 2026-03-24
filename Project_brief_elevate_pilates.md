# Project Brief

## Elevate Pilates Instructor Training LMS

Prepared as a detailed project brief for a custom internal training platform.

## Client

Elevate Pilates

## Project Type

Custom internal LMS / e-learning platform for Pilates instructor training.

## Primary Goal

Train instructor trainees to become studio-ready LMA instructors through a guided internal learning pathway.

## Target Timeline

ASAP start with phased MVP delivery; launch target based on a 25-30 day implementation window.

---

## Executive summary

Elevate Pilates needs a fast, dependable internal Learning Management System that helps reduce the shortage of qualified instructors by delivering structured training, video-led lessons, readings, quizzes, exams, and admin reporting in one place.

The system is for internal studio use only, with no public marketplace, no payment gateway, and no requirement for practical assessments inside the platform.

## 1) What we're building

A custom-built internal LMS for Elevate Pilates that supports instructor training through a guided, measurable, admin-controlled learning journey. The platform is intended to train instructor trainees efficiently, using structured modules, embedded learning content, and prerequisite-based progression so trainees can move through theory and platform-based evaluation before in-person practical assessment.

### Confirmed scope position

- Internal training platform only; not for public sale.
- No payment gateway is required.
- Content (videos and written learning material) will be provided by the client.
- Practical assessments will be conducted in person, outside the platform.
- The MVP must be configurable with 1 initial course containing 6 modules.

## 2) Business context and success criteria

Elevate Pilates operates Pilates studios and needs a scalable internal solution to shorten the path from trainee onboarding to instructor readiness. The platform should reduce manual follow-up, improve training consistency, and give admins visibility into learner completion, progress, and assessment results.

### Success indicators for MVP

- A trainee can receive an email invitation, activate their account securely, access assigned learning content, and move through modules in a clear sequence.
- Admins can create and manage course structure, content items, and assessments without developer support for routine edits.
- Quizzes and exams work reliably, and progression rules prevent learners from unlocking later stages before completing prerequisites.
- The system stores learning records such as attempts, scores, completion timestamps, and percentage progress.
- Reminder emails help bring inactive trainees back into the learning flow.
- Production MVP is live with one configured course containing six modules.

## 3) Confirmed users, roles, and permissions

The role model in this brief is two roles only: Admin and Trainee.

### A) Admin

- Create, edit, publish, and archive courses and modules.
- Manage readings, embedded videos, quizzes, and exams.
- Track trainee completion, attempts, scores, and inactivity.
- Review prerequisite status and monitor who is ready for the next stage.
- Trigger or monitor reminder email flows.
- Access high-level reporting and learner performance views.

### B) Trainee

- Log in securely and access assigned learning materials.
- View module status, percentage completion, and next required steps.
- Consume readings and videos, attempt quizzes, and complete exams.
- Unlock subsequent modules only when progression rules are satisfied.
- See their own progress history and completion state.

## 4) Phase-wise delivery plan

### Phase 1 - Foundation and content operations

#### Deliverables

- Cloud infrastructure configuration (staging and production)
- User authentication (trainee and admin roles)
- Course and module management setup
- Admin CMS for creating/editing courses, modules, readings, videos, and quizzes
- Basic video embedding/streaming functionality
- Documentation: admin user guide and technical runbook

#### Objectives

- Set up cloud hosting and CI/CD pipeline for deployment
- Implement user authentication and role-based access
- Create a CMS for course and module management
- Design and prototype the user interface for key flows

### Phase 2 - Learning logic, reporting, and MVP launch

#### Deliverables

- Quiz engine supporting MCQ, true/false, and multi-select questions
- Progress tracking and prerequisite-based progression features
- Admin dashboard with trainee performance views and basic reporting
- Automated reminder emails for inactive trainees
- Finalized UI/UX enhancements
- Training session for admins and recording
- Functional MVP deployed to production with 1 course containing 6 configured modules

#### Objectives

- Implement interactive quizzes and exam functionality
- Enable progress tracking and reporting for admins
- Automate reminder notifications for trainees
- Conduct user acceptance testing and finalize MVP for launch

## 5) Platform modules and feature breakdown

### Module 1: Infrastructure and environment setup

- Staging and production environments configured.
- CI/CD pipeline for controlled deployments.
- Secure hosting baseline, environment variables, backups, and domain/SSL setup.
- Technical runbook for operational handover and maintenance.

### Module 2: Authentication and role-based access

- Secure authentication for Admin and Trainee roles using an invite-based trainee onboarding flow.
- Role-based permissions to separate content administration from learner access.
- Session handling, password reset flow, basic account management, and secure first-time password creation for invited trainees.
- Foundation for future extension if more internal staff roles are introduced later.
- Invite-based trainee onboarding flow.

### Module 3: Admin CMS and course management

- Admin can create and edit courses, modules, readings, videos, quizzes, and exams.
- Structured content hierarchy: course -> module -> lesson content -> knowledge checks/exams.
- Draft/publish workflow for content readiness.
- Designed so future courses can be added with minimal developer involvement where possible.
- Confirmed implementation approach: one unified custom CMS in the platform for managing all learning objects (courses, modules, readings, videos, quizzes, and exams).

### Module 4: Learning content delivery

- Embedded video playback for client-provided training content.
- Integrated reading materials presented inside the platform rather than depending only on PDF downloads.
- Mobile-responsive learner experience for tablet and phone usage.
- Clear module screens showing learning content and next required actions.

### Module 5: Quiz and exam engine

- Support for mixed question types: MCQ, true/false, and multi-select.
- Instant grading behavior for fun/practice quizzes where appropriate.
- End-of-assessment grading for formal exam flows.
- Attempt tracking, score capture, and pass/fail thresholds to control unlock behavior.
- In case of exam failure, 2 reattempts are allowed.
- Clarification: 2 reattempts means 3 total attempts per exam (1 initial + 2 retakes).

### Module 6: Progress tracking and prerequisite progression

- Percentage completion at course and module level.
- Tracking of lesson viewed, reading completed, quiz attempted, exam passed, and overall module state.
- Prerequisite rules that lock later modules until required completion criteria are satisfied.
- Visibility for both trainee and admin into what is complete, pending, or blocked.
- Confirmed progression rule for MVP: exam pass is the core unlock gate. A module unlocks only when required completion criteria are met, with exam pass required where an exam/checkpoint is configured.

### Module 7: Admin dashboard and reporting

- Performance views for each trainee, including completion status and assessment history.
- At-a-glance admin dashboard for identifying inactive or incomplete learners.
- Basic reporting for attempts, progress, and completion records.
- Operational visibility to support readiness decisions before in-person practical checks.

### Module 8: Reminder automation and engagement prompts

- Automated email reminders for inactive trainees.
- Configurable reminder cadence and simple engagement prompts.
- Admin visibility into who requires follow-up.
- Designed to reduce manual chasing and improve completion rates.
- Confirmed trigger for MVP reminders: trainee is incomplete by due date.
- Due date scope for MVP is per course only (not per module).

## 6) Initial launch configuration: 1 course with 6 modules

Planning note: exact learning content titles and lesson breakdown should be finalized with Angel Ekanga based on supplied material. To keep this brief detailed without inventing final client-owned curriculum names, the structure below is a recommended launch framework.

| Module | Recommended launch focus | Typical platform components |
|---|---|---|
| 01 | Orientation and program overview | Welcome video, readings, expectations, completion rules |
| 02 | Core theory and written learning | Readings, embedded videos, short quiz |
| 03 | Technique or method instruction | Video lessons, guided notes, checkpoint quiz |
| 04 | Teaching standards and practical preparation | Readings, demonstration videos, graded checkpoint |
| 05 | Knowledge consolidation | Revision content, mixed quiz formats, practice assessment |
| 06 | Final theory assessment and readiness status record | Formal exam, pass/fail outcome, completion readiness status |

## 7) Key user flows

### Flow A - Admin setup and publishing

- Admin logs in, creates trainee accounts, and sends invitation links by email to assigned trainees.
- Admin creates 6 modules and adds readings, embedded videos, quizzes, and the final exam.
- Admin defines pass thresholds and prerequisite rules.
- Admin assigns the course to trainees.
- Platform begins tracking learning activity and completion data.

### Flow B - Trainee learning journey

- Trainee opens the invitation link from email, sets a password, enters required profile details, completes account setup, and lands on the assigned course dashboard.
- Clarification: trainee account is created only when the invite is accepted and onboarding is completed.
- Trainee opens Module 1 and completes required reading/video steps.
- Trainee completes quiz or exam requirements as configured.
- If requirements are met, the next module unlocks automatically.
- Trainee continues through all 6 modules until final assessment and completion state are reached.

### Flow C - Monitoring and follow-up

- Admin dashboard highlights inactive, incomplete, or low-performing trainees.
- Reminder emails are sent based on inactivity or outstanding steps.
- Admin reviews attempt history, scores, and course completion records.
- Business uses these records to support operational readiness and next-step decisions.

## 8) Technology stack

- Frontend: React.
- Backend / API layer: Node.js + Express.js.
- Database: Firebase Firestore.
- Authentication: Firebase Auth.
- File storage (videos, assets): Firebase Storage.
- Cloud infrastructure must support staging and production environments, CI/CD, secure configuration management, and production-grade deployment controls.

## 9) Non-functional requirements

- Responsive experience across desktop, tablet, and mobile.
- Reliable storage of learning records including attempts, scores, timestamps, and completion status.
- Maintainable architecture that supports future course additions.
- Clear admin UX so routine content updates can be handled without engineering involvement where feasible.
- Production deployment with staging parity and documented operational procedures.
- Reasonable performance for video-rich learning pages and admin reporting screens.

## 10) Assumptions and exclusions

### Assumptions

- All initial training content will be supplied by Elevate Pilates.
- Angel Ekanga is the main subject-matter contributor for launch content.
- The first release is internal-only and does not require ecommerce capabilities.
- Practical assessments remain offline and are outside the LMS feature set.
- MVP course assignment model: one course in MVP, assignable to multiple trainees.
- Basic reporting scope is acceptable for MVP launch.
- Basic user profile capture is acceptable for MVP launch.
- MVP security baseline includes password policy enforcement (minimum length + uppercase + lowercase + number + symbol).

### Exclusions from initial MVP

- No public course catalog.
- No payment gateway.
- No public self-service registration for external customers.
- No in-platform practical assessment execution.
- No advanced marketplace, certificate-commerce, or public community features.

## 11) Scope snapshot

| Area | Included in MVP | Notes |
|---|---|---|
| Internal LMS for studio use | Yes | Private training platform for Elevate Pilates |
| Admin and Trainee roles | Yes | 2 confirmed roles only |
| 1 initial course | Yes | Explicitly stated in Phase 2 deliverables |
| 6 configured modules | Yes | Configured in MVP production launch |
| Quiz engine | Yes | MCQ, true/false, and multi-select |
| Progress tracking and prerequisites | Yes | Controls unlock logic and visibility |
| Reminder emails | Yes | For inactive trainees |
| Payment gateway | No | Out of scope |
| Practical assessments in platform | No | Conducted in person |
| Future additional courses | Planned | Architecture should support expansion |

Recommendation: Proceed with a two-phase MVP delivery plan that establishes the platform foundation first, then adds assessment logic, progression, reporting, and reminders. This approach matches the client brief, keeps the release realistic, and provides a structured base for future course expansion.

## 12) Immediate next steps

To move from brief to execution, the following should be confirmed first:

- Finalize detailed deployment ownership, environment access, and Firebase project setup responsibilities.
- Confirm the exact titles and sequence of the initial 6 course modules.
- Review Angel's first batch of videos and written material for import readiness.
- Approve UI/UX designs for admin CMS, learner dashboard, module detail page, quiz flow, and reporting screens.
- Confirm exam retake policy and reminder cadence before build finalization.
- Confirm final password policy parameters (minimum length and complexity requirements).

## 13) Seller response checklist

- Examples of previously built custom LMS or e-learning systems.
- Experience implementing prerequisite-based progression.
- Estimated timeline for this 1-course / 6-module MVP.
- Approach for providing full UI/UX design before development.
- Approach for hosting, deployment, CI/CD, and post-launch support.

## 14) MVP acceptance criteria (approved clarifications)

The following acceptance criteria apply in addition to the existing scope and deliverables.

### Architecture and stack

- React frontend with Node.js + Express.js API backend.
- Firebase Firestore as the application database.
- Firebase Auth for authentication.
- Firebase Storage for all training videos and file assets.
- All training videos are stored in Firebase Storage and linked to learner module content.

### CMS and content operations

- One unified custom CMS is available for Admin to manage courses, modules, readings, videos, quizzes, and exams.

### Users, onboarding, and assignments

- Only Admin and Trainee roles are active in MVP.
- Trainee accounts are created only after invite acceptance and onboarding completion.
- One course is configured for MVP and can be assigned to multiple trainees.

### Assessments and progression

- Exam policy allows 2 retakes (3 total attempts per exam).
- Progression logic uses exam pass as the core unlock gate with prerequisite checks enforced.
- Later modules remain locked until prerequisite conditions are satisfied.

### Reminders and due dates

- Reminder automation includes incomplete-by-due-date trigger.
- Due dates are configured at course level only in MVP.

### Reporting and profiles (basic MVP)

- Basic reporting is available for completion status, overdue status, attempts, scores, and completion timestamps.
- Basic trainee profile details are captured during onboarding.

### Security

- Password policy is enforced and includes minimum length plus uppercase, lowercase, number, and symbol requirements.

### Delivery quality

- Staging and production environments are operational.
- CI/CD pipeline is functional.
- MVP is deployed with one configured course containing six modules.
