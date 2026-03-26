import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import { HomePage } from '../pages/HomePage.jsx'
import { LoginPage } from '../pages/LoginPage.jsx'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx'
import { InviteAcceptPage } from '../pages/InviteAcceptPage.jsx'
import { ForcedPasswordChangePage } from '../pages/ForcedPasswordChangePage.jsx'
import { TraineeDashboardPage } from '../pages/TraineeDashboardPage.jsx'
import { TraineeModulePage } from '../pages/TraineeModulePage.jsx'
import { TraineeLessonPage } from '../pages/TraineeLessonPage.jsx'
import { CourseListPage } from '../pages/CourseListPage.jsx'
import { AdminCourseDetailPage } from '../pages/AdminCourseDetailPage.jsx'
import { AdminModuleDetailPage } from '../pages/AdminModuleDetailPage.jsx'
import { LessonEditorPage } from '../pages/LessonEditorPage.jsx'
import { AdminLessonPreviewPage } from '../pages/AdminLessonPreviewPage.jsx'
import { UserManagementPage } from '../pages/UserManagementPage.jsx'
import { ProfilePage } from '../pages/ProfilePage.jsx'
import { NotFoundPage } from '../pages/NotFoundPage.jsx'

export function AppRoutes() {
  return (
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
          element={<Navigate to="/admin/courses" replace />}
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
              <LessonEditorPage />
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
          path="admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <UserManagementPage />
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
  )
}
