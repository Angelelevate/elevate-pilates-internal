import cron from 'node-cron'
import { getEnv } from './config/env.js'
import { createApp } from './app.js'

const { port } = getEnv()
const app = createApp()

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)

  // Schedule reminder scan (default: daily at 9 AM)
  const schedule = process.env.REMINDER_CRON || '0 9 * * *'
  if (cron.validate(schedule)) {
    cron.schedule(schedule, async () => {
      console.info('[cron] Running automated reminder scan…')
      try {
        const { runReminderScan } = await import('./services/reminderService.js')
        const result = await runReminderScan()
        console.info('[cron] Reminder scan complete:', result)
      } catch (err) {
        console.error('[cron] Reminder scan failed:', err?.message)
      }
    })
    console.log(`[cron] Reminder scheduler registered (${schedule})`)
  }
})
