import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'

const BASE_TOC_SECTIONS = [
  { id: 'overview', label: 'Platform Overview' },
  { id: 'users', label: 'Managing Users' },
  { id: 'courses', label: 'Creating a Course' },
  { id: 'modules', label: 'Adding Modules' },
  { id: 'lessons', label: 'Creating Lessons' },
  { id: 'quizzes', label: 'Building Assessments' },
  { id: 'publishing', label: 'Publishing & Enrollment' },
  { id: 'progress', label: 'Tracking Progress' },
  { id: 'reports', label: 'Reports & Exports' },
  { id: 'reminders', label: 'Reminder Automation' },
]

const FAQ_SECTION = { id: 'faq', label: 'FAQ & Troubleshooting' }

/** Shipped with the app; admins can add more from the customize page. */
const BUILTIN_FAQ_ENTRIES = [
  {
    q: 'A trainee says their module is locked. What do I check?',
    a: 'Modules unlock sequentially. The trainee must complete all lessons and pass the exam (if required) in the previous module. Check their progress on the trainee detail page to see what\'s blocking them.',
  },
  {
    q: 'A trainee used all 3 exam attempts and failed. What now?',
    a: 'Go to the trainee detail page and click the exam\'s reset button, or use the admin API to reset their attempts. This lets them try again from scratch.',
  },
  {
    q: 'I updated a lesson but trainees see the old version.',
    a: 'Changes to published content are reflected immediately. If it\'s a video, the signed URL may be cached — ask the trainee to refresh or wait a few minutes.',
  },
  {
    q: 'Can I change a lesson type after creating it?',
    a: 'No. Lesson type is set at creation. To change it, archive the lesson and create a new one of the desired type in its place.',
  },
  {
    q: 'How do I remove a trainee from a course?',
    a: 'Go to the course enrollment list and change their enrollment status to "Withdrawn". They will no longer see the course on their dashboard.',
  },
  {
    q: 'Can trainees see their own scores?',
    a: 'Yes. After submitting a quiz or exam, trainees see their score, per-question breakdown with correct answers, and explanations. For exams, they also see pass/fail status and remaining attempts.',
  },
  {
    q: 'What happens when a trainee completes the entire course?',
    a: 'Their enrollment status changes to "Completed" automatically. They see a completion celebration on their dashboard. You\'ll see them in the "Completed" filter on the trainee performance page.',
  },
]

function SectionIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="shrink-0 text-sage-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-deep text-xs font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-stone-700">{children}</div>
    </div>
  )
}

function Tip({ children }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0 text-sage-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

function NavTo({ to, children }) {
  return <Link to={to} className="font-semibold text-deep underline-offset-2 hover:underline">{children}</Link>
}

export function AdminGuidePage() {
  const [active, setActive] = useState('overview')
  const [extraFaq, setExtraFaq] = useState([])
  const [customSections, setCustomSections] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/api/admin/platform-guide')
        if (!cancelled) {
          setExtraFaq(data.faq || [])
          setCustomSections(data.customSections || [])
        }
      } catch {
        if (!cancelled) {
          setExtraFaq([])
          setCustomSections([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tocSections = useMemo(
    () => [
      ...BASE_TOC_SECTIONS,
      ...customSections.map((s) => ({ id: `custom-${s.id}`, label: s.title })),
      FAQ_SECTION,
    ],
    [customSections],
  )

  function scrollTo(id) {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Sidebar TOC */}
      <aside className="lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-start">
        <div className="ui-surface p-3">
          <p className="ui-section-label px-2 pb-2">Guide Contents</p>
          <nav className="space-y-0.5">
            {tocSections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  active === s.id
                    ? 'bg-deep text-white font-medium'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                <SectionIcon />
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-section-label">Admin</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-stone-900">Platform Guide</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              Everything you need to know about managing courses, content, assessments, and trainees on
              the Elevate Pilates training platform.
            </p>
          </div>
          <Link
            to="/admin/guide/customize"
            className="ui-btn-secondary shrink-0 text-sm"
          >
            Customize FAQ & sections
          </Link>
        </div>

        {/* ── Platform Overview ─────────────────────────── */}
        <section id="overview" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Platform Overview</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            Elevate Pilates is an internal instructor training LMS. The platform lets you build structured courses with modules and lessons,
            assess trainee knowledge through quizzes and exams, track progress with automatic prerequisite-based unlocking, and monitor
            completion through dashboards and reports.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: 'Courses', desc: 'Top-level containers. Each course has modules arranged in a strict sequence.' },
              { title: 'Modules', desc: 'Groups of related lessons within a course. Unlock one at a time as trainees progress.' },
              { title: 'Lessons', desc: 'Individual learning units — readings, videos, quizzes, or exams.' },
              { title: 'Assessments', desc: 'Practice quizzes (unlimited retakes) and formal exams (3 attempts, pass mark required).' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-stone-200/60 bg-stone-50/50 px-4 py-3">
                <p className="text-sm font-semibold text-stone-800">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <Tip>The typical workflow is: Invite users → Create a course → Add modules → Add lessons → Build assessments → Link assessments to lessons → Publish → Enroll trainees.</Tip>
        </section>

        {/* ── Managing Users ────────────────────────────── */}
        <section id="users" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Managing Users</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            Before trainees can access the platform, you need to invite them. The system uses invite-only registration — there is no public sign-up.
          </p>
          <div className="space-y-3">
            <Step n={1}>Go to <NavTo to="/admin/users">Users</NavTo> in the sidebar.</Step>
            <Step n={2}>Click <strong>Invite trainee</strong> and enter their email address. They'll receive an email with a unique registration link.</Step>
            <Step n={3}>Once they accept the invite and create their password, they appear in the users list with the <strong>trainee</strong> role.</Step>
            <Step n={4}>You can disable or re-enable any account from the user list. Disabled users cannot log in.</Step>
          </div>
          <Tip>Trainees must set a new password on first login if the "force password change" option is enabled.</Tip>
        </section>

        {/* ── Creating a Course ─────────────────────────── */}
        <section id="courses" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Creating a Course</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            A course is the top-level container for all your training content. In the MVP, you'll typically have one active course (e.g. "Elevate Pilates Instructor Certification").
          </p>
          <div className="space-y-3">
            <Step n={1}>Go to <NavTo to="/admin/courses">Courses</NavTo> in the sidebar.</Step>
            <Step n={2}>Click <strong>Create course</strong>. Enter a title and description.</Step>
            <Step n={3}>Optionally set a <strong>due date</strong> — this becomes the default deadline for all trainees enrolled in the course.</Step>
            <Step n={4}>Your course starts in <strong>Draft</strong> status. You can edit it freely before publishing.</Step>
          </div>
          <Tip>You cannot delete a course that has active enrollments. Withdraw all trainees first, or archive the course instead.</Tip>
        </section>

        {/* ── Adding Modules ───────────────────────────── */}
        <section id="modules" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Adding Modules</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            Modules are the building blocks of a course. They're arranged in a strict sequential order — trainees must complete Module 1 before Module 2 unlocks, and so on.
          </p>
          <div className="space-y-3">
            <Step n={1}>Open a course from the course list, then click <strong>Add module</strong>.</Step>
            <Step n={2}>Enter a <strong>title</strong> and optional <strong>description</strong>.</Step>
            <Step n={3}>
              Set <strong>completion criteria</strong>:
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-stone-600">
                <li><em>All lessons completed</em> — every published lesson must be finished.</li>
                <li><em>Exam passed</em> — if the module has an exam lesson, the trainee must pass it.</li>
              </ul>
            </Step>
            <Step n={4}>Drag and drop modules to <strong>reorder</strong> them. The order determines the unlock sequence for trainees.</Step>
          </div>
          <Tip>Each module can be published independently, but the entire course must be published for trainees to see it.</Tip>
        </section>

        {/* ── Creating Lessons ──────────────────────────── */}
        <section id="lessons" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Creating Lessons</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            Lessons are the individual content pieces within a module. There are four lesson types:
          </p>
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200/60 bg-stone-50/50 p-4">
              <p className="text-sm font-semibold text-stone-800">Reading Lessons</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">Rich text content created with the built-in editor. Supports headings, bold/italic, lists, links, and blockquotes. Trainees click "Mark as completed" when done.</p>
            </div>
            <div className="rounded-xl border border-stone-200/60 bg-stone-50/50 p-4">
              <p className="text-sm font-semibold text-stone-800">Video Lessons</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">Upload a video file directly from the lesson editor. Videos are stored securely and streamed to trainees. Auto-completes when the trainee reaches ~90% or the video ends. Progress saves every ~12 seconds.</p>
            </div>
            <div className="rounded-xl border border-stone-200/60 bg-stone-50/50 p-4">
              <p className="text-sm font-semibold text-stone-800">Quiz Lessons</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">Practice knowledge checks. Link a published quiz from the assessment library. Submitting the quiz marks the lesson complete regardless of score. Unlimited retakes.</p>
            </div>
            <div className="rounded-xl border border-stone-200/60 bg-stone-50/50 p-4">
              <p className="text-sm font-semibold text-stone-800">Exam Lessons</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">Formal gated assessments. Link a published exam from the assessment library. The trainee must pass (meet the pass mark) for the lesson to count as completed. Maximum 3 attempts.</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-stone-800">Steps to create a lesson:</p>
            <Step n={1}>Open a module from the course detail page.</Step>
            <Step n={2}>Click <strong>Add lesson</strong> and choose a type (reading, video, quiz, or exam).</Step>
            <Step n={3}>Give it a title. The lesson opens in the editor.</Step>
            <Step n={4}>
              Add content based on the type:
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-stone-600">
                <li><strong>Reading:</strong> Write or paste content in the rich text editor and click <em>Save reading</em>.</li>
                <li><strong>Video:</strong> Click <em>Choose file</em> and upload your video. Wait for the upload to complete.</li>
                <li><strong>Quiz/Exam:</strong> Select a published assessment from the dropdown and click <em>Save reference</em>.</li>
              </ul>
            </Step>
            <Step n={5}>Drag and drop lessons to reorder them within the module.</Step>
          </div>
          <Tip>Video lessons require the file to be uploaded before the lesson can be published. You'll see an error if you try to publish without a video.</Tip>
        </section>

        {/* ── Building Assessments ──────────────────────── */}
        <section id="quizzes" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Building Assessments</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            Assessments (quizzes and exams) are created in a dedicated area and then linked to lessons. This means a single quiz can be previewed and managed independently of lessons.
          </p>
          <div className="space-y-3">
            <Step n={1}>Go to <NavTo to="/admin/quizzes">Assessments</NavTo> in the sidebar.</Step>
            <Step n={2}>Click <strong>+ New assessment</strong>. Choose a title, type (Practice Quiz or Formal Exam), and the course it belongs to.</Step>
            <Step n={3}>
              In the assessment editor, configure settings:
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-stone-600">
                <li><strong>Pass mark</strong> (exams only) — the minimum score percentage to pass (default 70%).</li>
                <li><strong>Time limit</strong> (exams only) — optional countdown in minutes. Auto-submits when time runs out.</li>
                <li><strong>Question order</strong> — fixed or shuffled per attempt.</li>
                <li><strong>Option order</strong> — fixed or shuffled per attempt.</li>
                <li><strong>Display mode</strong> — all questions on one page, or one question per page.</li>
              </ul>
            </Step>
            <Step n={4}>
              Add questions using <strong>+ Add question</strong>. Three types are supported:
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-stone-600">
                <li><strong>Multiple Choice (MCQ)</strong> — 2–6 options, exactly one correct.</li>
                <li><strong>True / False</strong> — two options, one correct.</li>
                <li><strong>Multi-Select</strong> — 2–6 options, one or more correct. All-or-nothing scoring (no partial credit).</li>
              </ul>
            </Step>
            <Step n={5}>For each question, mark the correct answer(s), set the point value, and optionally add an explanation (shown after grading).</Step>
            <Step n={6}>Drag questions to reorder them.</Step>
            <Step n={7}>Click <strong>Publish</strong> when the assessment is ready. It will then appear in the quiz/exam dropdown when editing lessons.</Step>
          </div>
          <Tip>Correct answers are never sent to the trainee's browser during an active attempt. All grading happens on the server.</Tip>
          <Tip>For exams, each trainee gets 3 total attempts. After 3 failures the exam locks. You can reset attempts from the trainee detail page.</Tip>
        </section>

        {/* ── Publishing & Enrollment ──────────────────── */}
        <section id="publishing" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Publishing & Enrolling Trainees</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            Content goes through a draft → published lifecycle. Trainees can only see published content.
          </p>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-stone-800">Publishing checklist:</p>
            <Step n={1}>Ensure all lessons within a module have content and are individually published.</Step>
            <Step n={2}>Publish each module from the module detail page.</Step>
            <Step n={3}>Publish the course from the course detail page. The system validates that at least one module with at least one lesson exists.</Step>
          </div>
          <div className="space-y-3 pt-2">
            <p className="text-sm font-semibold text-stone-800">Enrolling trainees:</p>
            <Step n={1}>Open the course detail page and go to the <strong>Enrollments</strong> section.</Step>
            <Step n={2}>Select one or more trainees from the list and click <strong>Enroll</strong>.</Step>
            <Step n={3}>Optionally set a per-enrollment due date (overrides the course default).</Step>
            <Step n={4}>Once enrolled, the trainee sees the course on their dashboard and can begin Module 1 immediately.</Step>
          </div>
          <Tip>When a trainee is enrolled, the system automatically creates their progress records — Module 1 starts as "In Progress" and all subsequent modules are "Locked" until prerequisites are met.</Tip>
        </section>

        {/* ── Tracking Progress ─────────────────────────── */}
        <section id="progress" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Tracking Progress</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            The platform automatically tracks every trainee's progress at three levels:
          </p>
          <div className="space-y-2 text-sm text-stone-700">
            <p><strong>Lesson level:</strong> Each lesson is marked as completed when the trainee finishes the reading, watches ≥90% of a video, submits a quiz, or passes an exam.</p>
            <p><strong>Module level:</strong> A module is completed when all its lessons are done and the module exam (if any) is passed. The next module in sequence then unlocks automatically.</p>
            <p><strong>Course level:</strong> The course is completed when all modules are completed. The trainee's enrollment status changes to "Completed" automatically.</p>
          </div>
          <Tip>Progress percentages use a lesson-weighted formula for smooth increments — each completed lesson adds equally to the overall percentage.</Tip>
        </section>

        {/* ── Reports & Exports ─────────────────────────── */}
        <section id="reports" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Reports & Exports</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            The <NavTo to="/admin/dashboard">Dashboard</NavTo> gives you a real-time overview. For deeper analysis, use the dedicated report pages:
          </p>
          <div className="space-y-2 text-sm text-stone-700">
            <p><strong><NavTo to="/admin/trainees">Trainee Performance</NavTo></strong> — sortable, searchable table of all enrolled trainees with progress bars, status filters, and CSV export.</p>
            <p><strong><NavTo to="/admin/reports/overdue">Overdue Report</NavTo></strong> — trainees past their due date who haven't completed the course. Send reminders directly from this page.</p>
            <p><strong><NavTo to="/admin/reports/assessments">Assessment Report</NavTo></strong> — per-quiz/exam stats: total attempts, average score, pass rate, and first-attempt pass rate.</p>
            <p><strong><NavTo to="/admin/reports/completion">Course Completion</NavTo></strong> — overall metrics: enrolled, active, completed, completion rate, average completion time.</p>
          </div>
          <Tip>Every report page has an <strong>Export CSV</strong> button. Use it to download data for external analysis or record-keeping.</Tip>
        </section>

        {/* ── Reminder Automation ──────────────────────── */}
        <section id="reminders" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">Reminder Automation</h2>
          <p className="text-sm leading-relaxed text-stone-700">
            The system can automatically email trainees who are overdue or approaching their due date.
          </p>
          <div className="space-y-3">
            <Step n={1}>Go to <NavTo to="/admin/reminders/settings">Reminders → Settings</NavTo> and enable reminders.</Step>
            <Step n={2}>
              Configure:
              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-stone-600">
                <li><strong>Schedule</strong> — how often the system checks (daily, every 2 days, weekly).</li>
                <li><strong>Cooldown</strong> — minimum days between reminders to the same trainee.</li>
                <li><strong>Max reminders</strong> — cap on total reminders per trainee.</li>
                <li><strong>Warning days</strong> — send a pre-due-date warning email this many days before the deadline.</li>
              </ul>
            </Step>
            <Step n={3}>View sent reminders in the <NavTo to="/admin/reminders/log">Reminder Log</NavTo>.</Step>
            <Step n={4}>See who's next in the queue at <NavTo to="/admin/reminders/pending">Pending Reminders</NavTo>, with a "Send Now" button for immediate manual sends.</Step>
          </div>
          <Tip>Manual reminders bypass the cooldown period but still count toward the max reminders limit.</Tip>
        </section>

        {customSections.map((s) => (
          <section
            key={s.id}
            id={`custom-${s.id}`}
            className="ui-surface space-y-5 p-6 scroll-mt-4"
          >
            <h2 className="font-display text-xl font-semibold text-stone-900">{s.title}</h2>
            <div
              className="prose prose-stone max-w-none text-sm leading-relaxed text-stone-800 prose-headings:font-display prose-a:text-deep"
              dangerouslySetInnerHTML={{ __html: s.bodyHtml || '' }}
            />
          </section>
        ))}

        {/* ── FAQ ───────────────────────────────────────── */}
        <section id="faq" className="ui-surface space-y-5 p-6 scroll-mt-4">
          <h2 className="font-display text-xl font-semibold text-stone-900">FAQ & Troubleshooting</h2>
          <div className="space-y-4">
            {BUILTIN_FAQ_ENTRIES.map((item, i) => (
              <details key={`builtin-${i}`} className="group rounded-xl border border-stone-200/60">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50/50">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0 text-stone-400 transition-transform group-open:rotate-90">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {item.q}
                </summary>
                <p className="px-4 pb-3 pl-10 text-sm leading-relaxed text-stone-600">{item.a}</p>
              </details>
            ))}
            {extraFaq.length > 0 ? (
              <>
                <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Additional
                </p>
                {extraFaq.map((item) => (
                  <details key={item.id} className="group rounded-xl border border-stone-200/60">
                    <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50/50">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="shrink-0 text-stone-400 transition-transform group-open:rotate-90">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {item.question}
                    </summary>
                    <p className="px-4 pb-3 pl-10 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </>
            ) : null}
          </div>
        </section>

      </div>
    </div>
  )
}
