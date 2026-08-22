import { readFileSync } from 'fs'
import { platform } from 'os'

export type HostsLine = {
  raw: string
  ip?: string
  names?: string[]
  comment?: boolean
}

export function hostsFilePath(): string {
  return platform() === 'win32'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts'
}

export function readHostsFile(): {
  ok: boolean
  path: string
  lines: HostsLine[]
  error?: string
} {
  const path = hostsFilePath()
  try {
    const text = readFileSync(path, 'utf8')
    const lines = text.split(/\r?\n/).map((raw) => {
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return { raw, comment: true }
      }
      const withoutComment = trimmed.split('#')[0].trim()
      const parts = withoutComment.split(/\s+/)
      return {
        raw,
        ip: parts[0],
        names: parts.slice(1)
      }
    })
    return { ok: true, path, lines }
  } catch (err) {
    return {
      ok: false,
      path,
      lines: [],
      error: err instanceof Error ? err.message : 'Could not read hosts file'
    }
  }
}
