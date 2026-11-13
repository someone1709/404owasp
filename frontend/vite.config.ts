import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Strict Content-Security-Policy for the production build only.
// (Dev mode needs inline scripts for hot reload, so we skip it there.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  // Backend runs on :4100 in dev. Same-origin /api calls, so no CORS and no env vars.
  server: { proxy: { '/api': 'http://localhost:4100' } },
})
