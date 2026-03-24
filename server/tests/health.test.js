import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'

describe('GET /api/health', () => {
  it('returns 200 and expected shape', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health').expect(200)

    assert.equal(res.body.status, 'ok')
    assert.ok(typeof res.body.environment === 'string')
    assert.ok(typeof res.body.uptime === 'number')
    assert.ok(typeof res.body.timestamp === 'string')
  })
})
