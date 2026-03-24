import { getEnv } from '../config/env.js'

const startedAt = Date.now()

export function getHealth(req, res) {
  const { nodeEnv } = getEnv()
  res.json({
    status: 'ok',
    environment: nodeEnv,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
}
