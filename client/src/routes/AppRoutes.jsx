import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import { LoadingSpinner } from '../components/LoadingSpinner.jsx'
// Entry + trainee-facing pages stay eager: these are the first paint for every
// trainee, so splitting them would only add a round trip before content shows.
import { HomePage } from '../pages/HomePage.jsx'
import { LoginPage } from '../pages/LoginPage.jsx'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx'
import { InviteAcceptPage } from '../pages/InviteAcceptPage.jsx'
import { ForcedPasswordChangePage } from '../pages/ForcedPasswordChangePage.jsx'
import { TraineeDashboardPage } from '../pages/TraineeDashboardPage.jsx'
import { TraineeModulePage } from '../pages/TraineeModulePage.jsx'
import { TraineeLessonPage } from '../pages/TraineeLessonPage.jsx'
import { ProfilePage } from '../pages/ProfilePage.jsx'
import { NotFoundPage } from '../pages/NotFoundPage.jsx'

// Admin-only pages — code-split so trainees (the majority of users, typically on
// mobile) don't download the entire admin UI they can never reach. Every route
// below is gated on `roles={['admin']}`.
const lazyPage = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] })))

const LessonEditorPage = lazyPage(() => import('../pages/LessonEditorPage.jsx'), 'LessonEditorPage')
const AdminGuideCustomizePage = lazyPage(() => import('../pages/AdminGuideCustomizePage.jsx'), 'AdminGuideCustomizePage')
const CourseListPage = lazyPage(() => import('../pages/CourseListPage.jsx'), 'CourseListPage')
const AdminCourseDetailPage = lazyPage(() => import('../pages/AdminCourseDetailPage.jsx'), 'AdminCourseDetailPage')
const AdminModuleDetailPage = lazyPage(() => import('../pages/AdminModuleDetailPage.jsx'), 'AdminModuleDetailPage')
const AdminLessonPreviewPage = lazyPage(() => import('../pages/AdminLessonPreviewPage.jsx'), 'AdminLessonPreviewPage')
const UserManagementPage = lazyPage(() => import('../pages/UserManagementPage.jsx'), 'UserManagementPage')
const QuizListPage = lazyPage(() => import('../pages/QuizListPage.jsx'), 'QuizListPage')
const QuizEditorPage = lazyPage(() => import('../pages/QuizEditorPage.jsx'), 'QuizEditorPage')
const AdminDashboardPage = lazyPage(() => import('../pages/AdminDashboardPage.jsx'), 'AdminDashboardPage')
const TraineeListPage = lazyPage(() => import('../pages/TraineeListPage.jsx'), 'TraineeListPage')
const TraineeDetailPage = lazyPage(() => import('../pages/TraineeDetailPage.jsx'), 'TraineeDetailPage')
const AdminGuidePage = lazyPage(() => import('../pages/AdminGuidePage.jsx'), 'AdminGuidePage')
const OverdueReportPage = lazyPage(() => import('../pages/ReportsPage.jsx'), 'OverdueReportPage')
const AssessmentReportPage = lazyPage(() => import('../pages/ReportsPage.jsx'), 'AssessmentReportPage')
const CourseCompletionReportPage = lazyPage(() => import('../pages/ReportsPage.jsx'), 'CourseCompletionReportPage')
const ReminderSettingsPage = lazyPage(() => import('../pages/ReminderPages.jsx'), 'ReminderSettingsPage')
const ReminderLogPage = lazyPage(() => import('../pages/ReminderPages.jsx'), 'ReminderLogPage')
const PendingRemindersPage = lazyPage(() => import('../pages/ReminderPages.jsx'), 'PendingRemindersPage')

function EditorFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingSpinner />
    </div>
  )
}

export function AppRoutes() {
  return (
    // One boundary for every code-split admin page below.
    <Suspense fallback={<EditorFallback />}>
    <Routes>
      {/* Invite signup runs without the main shell so partial sessions do not expose Profile / Log out. */}
      <Route path="invite/:token" element={<InviteAcceptPage />} />

      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />

        <Route
          path="account/change-password"
          element={
            <ProtectedRoute>
              <ForcedPasswordChangePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="dashboard"
          element={
            <ProtectedRoute roles={['trainee']}>
              <TraineeDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="courses/:courseId/modules/:moduleId"
          element={
            <ProtectedRoute roles={['trainee']}>
              <TraineeModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="courses/:courseId/modules/:moduleId/lessons/:lessonId"
          element={
            <ProtectedRoute roles={['trainee']}>
              <TraineeLessonPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin"
          element={<Navigate to="/admin/dashboard" replace />}
        />
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/courses"
          element={
            <ProtectedRoute roles={['admin']}>
              <CourseListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/courses/:courseId"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminCourseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/courses/:courseId/modules/:moduleId"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminModuleDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/lessons/:lessonId"
          element={
            <ProtectedRoute roles={['admin']}>
              <Suspense fallback={<EditorFallback />}>
                <LessonEditorPage />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/lessons/:lessonId/preview"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLessonPreviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/quizzes"
          element={
            <ProtectedRoute roles={['admin']}>
              <QuizListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/quizzes/:quizId"
          element={
            <ProtectedRoute roles={['admin']}>
              <QuizEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/trainees"
          element={
            <ProtectedRoute roles={['admin']}>
              <TraineeListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/trainees/:traineeId"
          element={
            <ProtectedRoute roles={['admin']}>
              <TraineeDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/overdue"
          element={
            <ProtectedRoute roles={['admin']}>
              <OverdueReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/assessments"
          element={
            <ProtectedRoute roles={['admin']}>
              <AssessmentReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/completion"
          element={
            <ProtectedRoute roles={['admin']}>
              <CourseCompletionReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reminders"
          element={<Navigate to="/admin/reminders/settings" replace />}
        />
        <Route
          path="admin/reminders/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <ReminderSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reminders/log"
          element={
            <ProtectedRoute roles={['admin']}>
              <ReminderLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reminders/pending"
          element={
            <ProtectedRoute roles={['admin']}>
              <PendingRemindersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/guide"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminGuidePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/guide/customize"
          element={
            <ProtectedRoute roles={['admin']}>
              <Suspense fallback={<EditorFallback />}>
                <AdminGuideCustomizePage />
              </Suspense>
            </ProtectedRoute>
          }
        />

        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
