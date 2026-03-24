import {
  getPublicConfig,
  getSystemConfig,
} from '../services/configService.js'

export function getPublic(req, res) {
  res.json(getPublicConfig())
}

export function getSystem(req, res) {
  res.json(getSystemConfig())
}
