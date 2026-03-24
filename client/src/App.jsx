import { BrowserRouter } from 'react-router-dom'
import { isMaintenanceMode } from './config/env.js'
import { MaintenancePage } from './pages/MaintenancePage.jsx'
import { AppRoutes } from './routes/AppRoutes.jsx'

export default function App() {
  if (isMaintenanceMode()) {
    return <MaintenancePage />
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
