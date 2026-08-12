import { safeStorage } from 'electron'

/** Whether OS-backed secret encryption is available. */
export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Encrypt a UTF-8 secret to base64.
 * Throws if OS secure storage is unavailable.
 */
export function encryptSecret(plain: string): string {
  if (!plain) return ''
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'OS secure storage is unavailable. Passwords cannot be saved on this system.'
    )
  }
  return safeStorage.encryptString(plain).toString('base64')
}

/**
 * Decrypt a base64 secret from encryptSecret.
 * Also accepts legacy `plain:` base64 payloads from older builds (read-only).
 */
export function decryptSecret(enc?: string): string {
  if (!enc) return ''
  if (enc.startsWith('plain:')) {
    return Buffer.from(enc.slice(6), 'base64').toString('utf-8')
  }
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  }
  return ''
}
