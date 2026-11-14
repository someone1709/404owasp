import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

// The Vercel function (api/index.js) is generated from the backend source and committed.
// This fails when someone changes the backend but forgets to regenerate it, which would
// otherwise deploy an old API.
test('api/index.js matches the backend source', () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url))
  assert.doesNotThrow(() => execFileSync(process.execPath, ['bundle.mjs', '--check'], { cwd, stdio: 'pipe' }), 'run `npm run bundle` and commit api/index.js')
})
