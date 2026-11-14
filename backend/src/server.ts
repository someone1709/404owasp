import { createApp } from './app.ts'
import { persistenceFromEnv } from './persistence.ts'

// PORT is set by hosts like Render; locally it defaults to 4100. No .env needed.
// Set KV_REST_API_URL and KV_REST_API_TOKEN only if you want data saved in Redis.
const port = Number(process.env.PORT) || 4100

createApp({ persistence: persistenceFromEnv() }).listen(port, () => {
  console.log(`NextUp API running on http://localhost:${port}`)
})
