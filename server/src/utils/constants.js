export const PLATFORM_NAME = 'Elevate Pilates LMS'

export const DEFAULT_INVITE_EXPIRY_DAYS = 7

/** ~200MB+ uploads are common; keep headroom for HD short clips (memory upload path). */
export const DEFAULT_MAX_VIDEO_BYTES = 750 * 1024 * 1024

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
]

export const DEFAULT_PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
}
