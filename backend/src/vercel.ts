import { createApp } from './app.ts'
import { persistenceFromEnv } from './persistence.ts'

// Vercel entry point (the `backend` service in vercel.json). The frontend is a separate service
// served from Vercel's CDN, so Express only handles /api.
// Data is kept in Redis when KV_REST_API_URL / KV_REST_API_TOKEN are set (see README), otherwise in
// memory, which on Vercel can reset between requests.
export default createApp({ serveFrontend: false, persistence: persistenceFromEnv() })
