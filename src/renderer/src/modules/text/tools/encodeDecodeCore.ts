export type EncodeKind =
  | 'base64'
  | 'base64url'
  | 'url'
  | 'html'
  | 'hex'
  | 'unicode'

export const ENCODE_KINDS: EncodeKind[] = [
  'base64',
  'base64url',
  'url',
  'html',
  'hex',
  'unicode'
]

export const ENCODE_LABELS: Record<EncodeKind, string> = {
  base64: 'Base64',
  base64url: 'Base64 URL',
  url: 'URL',
  html: 'HTML entities',
  hex: 'Hex',
  unicode: 'Unicode escapes'
}

function bytesToB64(bytes: Uint8Array, url: boolean): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin)
  if (!url) return b64
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64ToBytes(input: string, url: boolean): Uint8Array {
  let b64 = input.trim().replace(/\s+/g, '')
  if (url) b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function utf8Text(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

const HTML_NAMED: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

function encodeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_NAMED[ch] || ch)
}

function decodeHtml(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'"
  }
  return text
    .replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, body: string) => {
      if (body.startsWith('#x') || body.startsWith('#X')) {
        const code = parseInt(body.slice(2), 16)
        return Number.isFinite(code) ? String.fromCodePoint(code) : full
      }
      if (body.startsWith('#')) {
        const code = parseInt(body.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : full
      }
      return named[body.toLowerCase()] ?? full
    })
}

function encodeUnicode(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0
      if (cp > 0xffff) return `\\u{${cp.toString(16)}}`
      if (cp < 32 || cp > 126) return `\\u${cp.toString(16).padStart(4, '0')}`
      if (ch === '\\') return '\\\\'
      return ch
    })
    .join('')
}

function decodeUnicode(text: string): string {
  return text
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\\/g, '\\')
}

export function transformEncode(
  kind: EncodeKind,
  input: string,
  decode: boolean
): { ok: true; output: string } | { ok: false; error: string } {
  try {
    if (!decode) {
      switch (kind) {
        case 'base64':
          return { ok: true, output: bytesToB64(utf8Bytes(input), false) }
        case 'base64url':
          return { ok: true, output: bytesToB64(utf8Bytes(input), true) }
        case 'url':
          return { ok: true, output: encodeURIComponent(input) }
        case 'html':
          return { ok: true, output: encodeHtml(input) }
        case 'hex':
          return {
            ok: true,
            output: [...utf8Bytes(input)]
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
          }
        case 'unicode':
          return { ok: true, output: encodeUnicode(input) }
      }
    }

    switch (kind) {
      case 'base64':
        return { ok: true, output: utf8Text(b64ToBytes(input, false)) }
      case 'base64url':
        return { ok: true, output: utf8Text(b64ToBytes(input, true)) }
      case 'url':
        return { ok: true, output: decodeURIComponent(input.replace(/\+/g, ' ')) }
      case 'html':
        return { ok: true, output: decodeHtml(input) }
      case 'hex': {
        const hex = input.replace(/[^0-9a-fA-F]/g, '')
        if (hex.length % 2) throw new Error('Hex length must be even')
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
        }
        return { ok: true, output: utf8Text(bytes) }
      }
      case 'unicode':
        return { ok: true, output: decodeUnicode(input) }
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not convert'
    }
  }
}

export function detectEncodeKind(input: string): EncodeKind | null {
  const t = input.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t) || /%[0-9A-Fa-f]{2}/.test(t)) return 'url'
  if (/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(t)) return 'html'
  if (/\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}/.test(t)) return 'unicode'
  if (/^(?:[A-Za-z0-9_-]{4,})+$/.test(t) && t.includes('-')) return 'base64url'
  if (/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(t) && t.length >= 8)
    return 'base64'
  if (/^(?:0x)?[0-9a-fA-F\s]+$/.test(t) && t.replace(/\s+/g, '').length >= 8)
    return 'hex'
  return null
}
