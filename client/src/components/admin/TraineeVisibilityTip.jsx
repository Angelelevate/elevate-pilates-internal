/**
 * Explains what must be true for enrolled trainees to see course content.
 * @param {{ variant?: 'compact' | 'full' }} props
 */
export function TraineeVisibilityTip({ variant = 'full' }) {
  if (variant === 'compact') {
    return (
      <p className="text-xs leading-relaxed text-stone-600">
        <span className="font-semibold text-stone-800">Trainees see only published content:</span>{' '}
        publish the <strong>course</strong>, each <strong>module</strong>, and each <strong>lesson</strong>,
        and <strong>enroll</strong> them on the course.
      </p>
    )
  }
  return (
    <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white p-5 text-sm text-sky-950 shadow-sm">
      <p className="font-display text-base font-semibold text-sky-950">What trainees can see</p>
      <p className="mt-1 text-sky-900/85">
        Draft items stay admin-only. All of the following must be true for a trainee to access a
        lesson:
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sky-900/90">
        <li>
          <strong>Course</strong> is <strong>Published</strong> (use Validate, then Publish on the
          course page).
        </li>
        <li>
          <strong>Module</strong> is <strong>Published</strong> (module page → publish when ready).
        </li>
        <li>
          <strong>Lesson</strong> is <strong>Published</strong> (lesson editor → publish after
          content and video upload).
        </li>
        <li>
          The trainee is <strong>enrolled</strong> on this course (Users → add with course, or
          Enrollments on the course page).
        </li>
      </ol>
      <p className="mt-3 border-t border-sky-200/60 pt-3 text-xs text-sky-900/75">
        <strong>Module title &amp; description</strong> are saved only when you click{' '}
        <strong>Save module</strong> — editing fields alone does not persist them.
      </p>
    </div>
  )
}
