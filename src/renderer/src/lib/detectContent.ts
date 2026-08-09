export type ContentKind =
  | 'json'
  | 'url'
  | 'color'
  | 'code'
  | 'jwt'
  | 'text'

export function detectContent(text: string): ContentKind {
  const t = text.trim()
  if (!t) return 'text'
  if (/^https?:\/\/\S+$/i.test(t)) return 'url'
  if (/^#[0-9a-f]{3,8}$/i.test(t) || /^rgba?\([^)]+\)$/i.test(t)) return 'color'
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) {
    try {
      const [, payload] = t.split('.')
      JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
      return 'jwt'
    } catch {
      /* fall through */
    }
  }
  if (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  ) {
    try {
      JSON.parse(t)
      return 'json'
    } catch {
      /* fall through */
    }
  }
  if (
    /^(import |export |const |function |class |def |package )/m.test(t) ||
    t.includes('=>') ||
    t.includes('```')
  ) {
    return 'code'
  }
  return 'text'
}

export function jwtPreview(token: string): string | null {
  try {
    const parts = token.trim().split('.')
    if (parts.length < 2) return null
    const json = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    )
    return JSON.stringify(json, null, 2)
  } catch {
    return null
  }
}
