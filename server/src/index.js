import { getEnv } from './config/env.js'
import { createApp } from './app.js'

const { port } = getEnv()
const app = createApp()

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
