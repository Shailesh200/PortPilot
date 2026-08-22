import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { encryptSecret, decryptSecret } from './secure-store'
import {
  getMacKeychainTrustPath,
  userDataFile
} from './paths'
import { resolveResourcePath } from './resources'
import { writeJsonAtomic } from './atomic-json'

/**
 * Session RAM + native OS credential store (Keychain / Credential Manager /
 * libsecret). Electron safeStorage is never used.
 *
 * Call persist/load only from connection save or connect — never at startup.
 */
export type SecretKind = 'password' | 'ssh'

const KEYCHAIN_SERVICE = 'com.portpilot.app'
const session = new Map<string, Partial<Record<SecretKind, string>>>()

interface SecretIndex {
  [connectionId: string]: Partial<Record<SecretKind, boolean>>
}

function indexPath(): string {
  return userDataFile('secret-index.json')
}

function fileVaultPath(): string {
  return userDataFile('secrets.json')
}

function accountName(id: string, kind: SecretKind): string {
  return `db:${id}:${kind}`
}

function loadIndex(): SecretIndex {
  try {
    if (!existsSync(indexPath())) return {}
    const parsed = JSON.parse(readFileSync(indexPath(), 'utf-8')) as SecretIndex
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistIndex(index: SecretIndex): void {
  writeJsonAtomic(indexPath(), index, { pretty: false })
}

function markIndex(id: string, kind: SecretKind, present: boolean): void {
  const index = loadIndex()
  const entry = { ...index[id] }
  if (present) entry[kind] = true
  else delete entry[kind]
  if (!entry.password && !entry.ssh) delete index[id]
  else index[id] = entry
  persistIndex(index)
}

export function secretIndexHas(id: string, kind: SecretKind): boolean {
  return Boolean(loadIndex()[id]?.[kind])
}

function cacheGet(id: string, kind: SecretKind): string {
  return session.get(id)?.[kind] ?? ''
}

function cacheSet(id: string, kind: SecretKind, value: string): void {
  const cur = session.get(id) ?? {}
  if (value) cur[kind] = value
  else delete cur[kind]
  session.set(id, cur)
}

export function clearSessionSecrets(): void {
  session.clear()
}

/** Keep a password in RAM for this process only — no OS store. */
export function rememberSecret(
  id: string,
  kind: SecretKind,
  value: string
): void {
  if (!id || !value) return
  cacheSet(id, kind, value)
}

function keychainAvailable(): boolean {
  // Sandboxed MAS builds cannot spawn /usr/bin/security. Secrets then use
  // the encrypted file vault inside the app container.
  if (process.mas) return false
  return process.platform === 'darwin' && existsSync('/usr/bin/security')
}

function macTrustArgs(): string[] {
  try {
    return ['-T', '/usr/bin/security', '-T', getMacKeychainTrustPath()]
  } catch {
    return ['-T', '/usr/bin/security']
  }
}

function keychainSet(account: string, secret: string): boolean {
  const r = spawnSync(
    '/usr/bin/security',
    [
      'add-generic-password',
      '-s',
      KEYCHAIN_SERVICE,
      '-a',
      account,
      '-w',
      secret,
      '-U',
      ...macTrustArgs()
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return r.status === 0
}

function keychainGet(account: string): string {
  const r = spawnSync(
    '/usr/bin/security',
    ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account, '-w'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  if (r.status !== 0) return ''
  return (r.stdout || '').replace(/\n$/, '')
}

function keychainDelete(account: string): void {
  spawnSync(
    '/usr/bin/security',
    ['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', account],
    { encoding: 'utf8', stdio: 'ignore' }
  )
}

function keychainDeleteAllForService(): void {
  if (!keychainAvailable()) return
  for (let i = 0; i < 200; i++) {
    const r = spawnSync(
      '/usr/bin/security',
      ['delete-generic-password', '-s', KEYCHAIN_SERVICE],
      { encoding: 'utf8', stdio: 'ignore' }
    )
    if (r.status !== 0) break
  }
}

function winTarget(account: string): string {
  return `PortPilot/${account}`
}

function winCred(
  op: 'get' | 'set' | 'delete',
  account: string,
  secret?: string
): { ok: boolean; value: string } {
  if (process.platform !== 'win32') return { ok: false, value: '' }
  const script = resolveResourcePath('win-cred.ps1')
  if (!existsSync(script)) return { ok: false, value: '' }
  const r = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Op',
      op,
      '-Target',
      winTarget(account)
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, PP_SECRET: secret ?? '' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  if (r.status !== 0) return { ok: false, value: '' }
  return { ok: true, value: (r.stdout || '').replace(/\r?\n$/, '') }
}

function linuxSecretTool(): string | null {
  if (process.platform !== 'linux') return null
  const r = spawnSync('which', ['secret-tool'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const p = (r.stdout || '').trim()
  return r.status === 0 && p ? p : null
}

function linuxSet(account: string, secret: string): boolean {
  const bin = linuxSecretTool()
  if (!bin) return false
  const r = spawnSync(
    bin,
    [
      'store',
      '--label',
      'PortPilot',
      'service',
      KEYCHAIN_SERVICE,
      'account',
      account
    ],
    { encoding: 'utf8', input: secret, stdio: ['pipe', 'pipe', 'pipe'] }
  )
  return r.status === 0
}

function linuxGet(account: string): string {
  const bin = linuxSecretTool()
  if (!bin) return ''
  const r = spawnSync(
    bin,
    ['lookup', 'service', KEYCHAIN_SERVICE, 'account', account],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  if (r.status !== 0) return ''
  return (r.stdout || '').replace(/\n$/, '')
}

function linuxDelete(account: string): void {
  const bin = linuxSecretTool()
  if (!bin) return
  spawnSync(
    bin,
    ['clear', 'service', KEYCHAIN_SERVICE, 'account', account],
    { encoding: 'utf8', stdio: 'ignore' }
  )
}

function readFileVault(): Record<string, string> {
  try {
    if (!existsSync(fileVaultPath())) return {}
    const parsed = JSON.parse(readFileSync(fileVaultPath(), 'utf-8')) as Record<
      string,
      string
    >
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeFileVault(data: Record<string, string>): void {
  writeJsonAtomic(fileVaultPath(), data, { pretty: false })
}

function fileSet(account: string, secret: string): void {
  const data = readFileVault()
  data[account] = encryptSecret(secret)
  writeFileVault(data)
}

function fileGet(account: string): string {
  const enc = readFileVault()[account]
  return enc ? decryptSecret(enc) : ''
}

function fileDelete(account: string): void {
  const data = readFileVault()
  if (!(account in data)) return
  delete data[account]
  writeFileVault(data)
}

function nativeSet(account: string, secret: string): boolean {
  if (keychainAvailable()) return keychainSet(account, secret)
  if (process.platform === 'win32') return winCred('set', account, secret).ok
  if (process.platform === 'linux') return linuxSet(account, secret)
  return false
}

function nativeGet(account: string): string {
  if (keychainAvailable()) return keychainGet(account)
  if (process.platform === 'win32') return winCred('get', account).value
  if (process.platform === 'linux') return linuxGet(account)
  return ''
}

function nativeDelete(account: string): void {
  if (keychainAvailable()) keychainDelete(account)
  else if (process.platform === 'win32') winCred('delete', account)
  else if (process.platform === 'linux') linuxDelete(account)
}

/** Persist a secret. Call only from connection save. */
export function saveSecret(id: string, kind: SecretKind, value: string): void {
  if (!id || !value) return
  cacheSet(id, kind, value)
  const account = accountName(id, kind)
  if (nativeSet(account, value)) fileDelete(account)
  else fileSet(account, value)
  markIndex(id, kind, true)
}

export function forgetPersistedSecret(id: string, kind: SecretKind): void {
  const account = accountName(id, kind)
  nativeDelete(account)
  fileDelete(account)
  markIndex(id, kind, false)
}

/**
 * Read a secret. Call only from connect / SSH tunnel setup.
 * Session cache first so reconnects in this process do not hit the OS store.
 */
export function loadSecret(id: string, kind: SecretKind): string {
  const cached = cacheGet(id, kind)
  if (cached) return cached
  const account = accountName(id, kind)
  let value = nativeGet(account)
  if (!value) value = fileGet(account)
  if (value) cacheSet(id, kind, value)
  return value
}

export function deleteSecrets(id: string): void {
  session.delete(id)
  for (const kind of ['password', 'ssh'] as const) {
    const account = accountName(id, kind)
    nativeDelete(account)
    fileDelete(account)
  }
  const index = loadIndex()
  if (index[id]) {
    delete index[id]
    persistIndex(index)
  }
}

export function deleteAllSecrets(): void {
  session.clear()
  keychainDeleteAllForService()
  const index = loadIndex()
  for (const id of Object.keys(index)) {
    for (const kind of ['password', 'ssh'] as const) {
      if (index[id]?.[kind]) nativeDelete(accountName(id, kind))
    }
  }
  try {
    if (existsSync(fileVaultPath())) writeFileVault({})
    if (existsSync(indexPath())) persistIndex({})
  } catch {
    /* ignore */
  }
}
