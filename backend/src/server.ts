import { createApp } from './app.ts'

// PORT is set by hosts like Render; locally it defaults to 4100. No .env needed.
const port = Number(process.env.PORT) || 4100

createApp().listen(port, () => {
  console.log(`NextUp API running on http://localhost:${port}`)
})
