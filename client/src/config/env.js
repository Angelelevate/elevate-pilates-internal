export function isMaintenanceMode() {
  return import.meta.env.VITE_MAINTENANCE_MODE === 'true'
}
