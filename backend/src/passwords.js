// Password hashing with scrypt (built into Node: no extra package). Each password gets its own random salt.
// The stored value describes itself, so the cost can be raised later without breaking old accounts:
//   scrypt$<N>$<r>$<p>$<salt, base64>$<hash, base64>

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64

const derive = (password, salt, n, r, p, length) =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)))
  })

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P, KEY_LENGTH)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored).split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

let dummy
/** A real hash to check against when the email is unknown, so a login takes the same time either way. */
export async function dummyHash() {
  dummy ??= hashPassword(randomBytes(12).toString('hex'))
  return dummy
}
