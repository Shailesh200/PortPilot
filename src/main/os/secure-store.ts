import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { getUserDataPath, userDataFile } from './paths'

/**
 * App-local AES-256-GCM. Electron safeStorage uses macOS Keychain
 * ("port-pilot Safe Storage") and shows a system password prompt — we never
 * call it.
 *
 * Prefixes:
 *   ppk1:   current format
 *   plain:  legacy unencrypted payloads (read-only)
 *   other:  old Keychain/safeStorage blobs — unreadable on purpose
 */
const PREFIX = 'ppk1:'
const ALGO = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 12
const TAG_LEN = 16

function keyPath(): string {
  return userDataFile('secret.key')
}

function loadOrCreateKey(): Buffer {
  const dir = getUserDataPath()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const p = keyPath()
  if (existsSync(p)) {
    const existing = readFileSync(p)
    if (existing.length === KEY_LEN) return existing
  }
  const key = randomBytes(KEY_LEN)
  writeFileSync(p, key, { mode: 0o600 })
  try {
    chmodSync(p, 0o600)
  } catch {
    /* best-effort on Windows */
  }
  return key
}

export function isSecureStorageAvailable(): boolean {
  return true
}

export function encryptSecret(plain: string): string {
  if (!plain) return ''
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, loadOrCreateKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, encrypted, tag]).toString('base64')
}

export function decryptSecret(enc?: string): string {
  if (!enc) return ''
  if (enc.startsWith('plain:')) {
    return Buffer.from(enc.slice(6), 'base64').toString('utf-8')
  }
  if (!enc.startsWith(PREFIX)) {
    return ''
  }
  try {
    const buf = Buffer.from(enc.slice(PREFIX.length), 'base64')
    if (buf.length < IV_LEN + TAG_LEN) return ''
    const iv = buf.subarray(0, IV_LEN)
    const tag = buf.subarray(buf.length - TAG_LEN)
    const data = buf.subarray(IV_LEN, buf.length - TAG_LEN)
    const decipher = createDecipheriv(ALGO, loadOrCreateKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf8'
    )
  } catch {
    return ''
  }
}

/** True when a stored blob exists but cannot be decrypted (legacy Keychain). */
export function storedSecretUnreadable(enc?: string): boolean {
  return Boolean(enc) && decryptSecret(enc) === ''
}
