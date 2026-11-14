// Builds the single-file serverless function Vercel runs (../api/index.js) from src/vercel.ts.
// Pre-bundling means Vercel never has to compile TypeScript or install backend packages.
//
//   node bundle.mjs           write ../api/index.js
//   node bundle.mjs --check   exit 1 if the committed file is out of date (used by the tests)

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = fileURLToPath(new URL('.', import.meta.url))
const out = fileURLToPath(new URL('../api/index.js', import.meta.url))

const result = await build({
  absWorkingDir: here,
  entryPoints: ['src/vercel.ts'],
  outfile: out,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  write: false,
  logLevel: 'error',
  footer: { js: 'module.exports = module.exports.default;' }, // so the file exports the app itself
})
const code = result.outputFiles[0].text

if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== code) {
    console.error('api/index.js is out of date. Run: npm run bundle')
    process.exit(1)
  }
  console.log('api/index.js is up to date')
} else {
  writeFileSync(out, code)
  console.log(`wrote api/index.js (${Math.round(code.length / 1024)} KB)`)
}
