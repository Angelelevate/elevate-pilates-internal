import { getEnv } from '../config/env.js'

/**
 * @param {{ to: string; token: string; name?: string | null }} params
 */
export async function sendInviteEmail({ to, token, name }) {
  const { frontendUrl } = getEnv()
  const base = String(frontendUrl || '').replace(/\/$/, '')
  const link = `${base}/invite/${token}`
  //TODO: Integrate transactional email (Resend, SendGrid, etc.). Replace console logging.
  console.info(
    `[invite-email] to=${to} name=${name ?? ''} link=${link}`,
  )
}
