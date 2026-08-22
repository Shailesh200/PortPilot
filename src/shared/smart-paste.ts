import type { ClipboardKind, TextToolId } from './types'
import { parseTimeQuery } from './time-convert'

export type SmartPasteHint = {
  tool: TextToolId
  label: string
  reason: string
}

function looksLikeJwt(t: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)
}

function looksLikeUrl(t: string): boolean {
  return /^https?:\/\/\S+$/i.test(t)
}

function looksLikeCurl(t: string): boolean {
  return /^\s*curl\b/i.test(t)
}

function looksLikeJson(t: string): boolean {
  if (
    !(
      (t.startsWith('{') && t.endsWith('}')) ||
      (t.startsWith('[') && t.endsWith(']'))
    )
  ) {
    return false
  }
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

function looksLikeBase64(t: string): boolean {
  if (t.length < 12 || t.length > 20_000) return false
  if (/\s/.test(t)) return false
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    t
  )
}

function looksLikeHex(t: string): boolean {
  const hex = t.replace(/\s+/g, '')
  return hex.length >= 16 && hex.length % 2 === 0 && /^(?:0x)?[0-9a-fA-F]+$/.test(hex)
}

function looksLikeHtmlEntities(t: string): boolean {
  return /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(t)
}

export function classifyClipboardKind(text: string): ClipboardKind {
  const t = text.trim()
  if (looksLikeUrl(t)) return 'url'
  if (/^#[0-9a-f]{3,8}$/i.test(t) || /^rgba?\([^)]+\)$/i.test(t)) return 'color'
  if (looksLikeJwt(t)) return 'jwt'
  if (looksLikeJson(t)) return 'json'
  if (/^(import |export |const |function |class |def )/m.test(t)) return 'code'
  return 'text'
}

/** Ranked tools to open for a pasted blob. Empty if nothing distinctive. */
export function detectSmartPaste(text: string): SmartPasteHint[] {
  const t = text.trim()
  if (!t) return []
  const out: SmartPasteHint[] = []

  if (looksLikeJwt(t)) {
    out.push({
      tool: 'jwt-inspector',
      label: 'Open in JWT Inspector',
      reason: 'Looks like a JWT'
    })
  }
  if (looksLikeCurl(t) || looksLikeUrl(t)) {
    out.push({
      tool: 'url-curl',
      label: 'Open in URL + cURL',
      reason: looksLikeCurl(t) ? 'Looks like a curl command' : 'Looks like a URL'
    })
  }
  if (looksLikeJson(t)) {
    out.push({
      tool: 'json-formatter',
      label: 'Open in JSON Formatter',
      reason: 'Looks like JSON'
    })
    out.push({
      tool: 'format-converter',
      label: 'Open in Format Converter',
      reason: 'Convert this JSON'
    })
  }
  if (looksLikeHtmlEntities(t) || looksLikeBase64(t) || looksLikeHex(t)) {
    out.push({
      tool: 'encode-decode',
      label: 'Open in Encode / Decode',
      reason: looksLikeHtmlEntities(t)
        ? 'Contains HTML entities'
        : looksLikeHex(t)
          ? 'Looks like hex'
          : 'Looks like Base64'
    })
  }
  const timeSnap = parseTimeQuery(t)
  if (timeSnap && timeSnap.source !== 'now') {
    out.push({
      tool: 'time',
      label: 'Open in Time bench',
      reason:
        timeSnap.source === 'epoch-s' || timeSnap.source === 'epoch-ms'
          ? 'Looks like an epoch timestamp'
          : 'Looks like a date / ISO timestamp'
    })
  }

  const seen = new Set<string>()
  return out.filter((h) => {
    if (seen.has(h.tool)) return false
    seen.add(h.tool)
    return true
  })
}
