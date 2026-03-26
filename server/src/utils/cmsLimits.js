export const MAX_COURSE_TITLE_LENGTH = 200
export const MAX_COURSE_DESCRIPTION_LENGTH = 4000

export function assertCourseTitleLength(value) {
  const t = value != null ? String(value).trim() : ''
  if (t.length > MAX_COURSE_TITLE_LENGTH) {
    const err = new Error(`Course title must be at most ${MAX_COURSE_TITLE_LENGTH} characters`)
    err.status = 400
    throw err
  }
}

export function assertCourseDescriptionLength(value) {
  const d = value != null ? String(value).trim() : ''
  if (d.length > MAX_COURSE_DESCRIPTION_LENGTH) {
    const err = new Error(
      `Course description must be at most ${MAX_COURSE_DESCRIPTION_LENGTH} characters`,
    )
    err.status = 400
    throw err
  }
}

export function assertCourseTextLimits(title, description) {
  assertCourseTitleLength(title)
  assertCourseDescriptionLength(description)
}
