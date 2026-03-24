import { getEnv } from '../config/env.js'
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  DEFAULT_PASSWORD_POLICY,
  PLATFORM_NAME,
} from '../utils/constants.js'

export function getPublicConfig() {
  const { inviteExpiryDays } = getEnv()
  return {
    platformName: PLATFORM_NAME,
    passwordPolicy: { ...DEFAULT_PASSWORD_POLICY },
    inviteExpiryDays: inviteExpiryDays ?? DEFAULT_INVITE_EXPIRY_DAYS,
  }
}

export function getSystemConfig() {
  const now = new Date().toISOString()
  const { maintenanceMode } = getEnv()
  return {
    platformName: PLATFORM_NAME,
    maintenanceMode,
    passwordPolicy: { ...DEFAULT_PASSWORD_POLICY },
    createdAt: now,
    updatedAt: now,
  }
}
