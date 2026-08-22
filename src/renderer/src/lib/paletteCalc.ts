import { parseTimeQuery, timeRows } from '../../../shared/time-convert'

export type PaletteCalcHit = {
  id: string
  label: string
  value: string
  description: string
}

function bytesToB64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function b64ToText(raw: string): string | null {
  try {
    let b64 = raw.trim().replace(/\s+/g, '')
    while (b64.length % 4) b64 += '='
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Scratchpad hits for Cmd+K. Empty if the query is not a calculator expression. */
export function paletteCalcHits(query: string): PaletteCalcHit[] {
  const q = query.trim()
  if (!q) return []
  const hits: PaletteCalcHit[] = []

  const time = parseTimeQuery(q)
  if (time) {
    const prefix = time.source === 'now' ? 'Now' : 'Time'
    for (const row of timeRows(time)
      .filter((r) => r.group !== 'zones')
      .slice(0, 6)) {
      hits.push({
        id: `time-${row.label}`,
        label: `${prefix} · ${row.label}`,
        value: row.value,
        description: `${row.value} — Enter copies`
      })
    }
    return hits
  }

  if (/^uuid(?:\s*v?4)?$/i.test(q)) {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-uuid`
    hits.push({
      id: 'uuid',
      label: 'UUID v4',
      value: id,
      description: `${id} — Enter copies`
    })
    return hits
  }

  const b64enc = q.match(/^(?:base64|b64)\s+(.+)$/is)
  if (b64enc) {
    const encoded = bytesToB64(b64enc[1])
    hits.push({
      id: 'b64-enc',
      label: 'Base64 encode',
      value: encoded,
      description: `${encoded.slice(0, 72)}${encoded.length > 72 ? '…' : ''} — Enter copies`
    })
    return hits
  }

  const b64dec = q.match(/^(?:decode|base64decode|b64d)\s+(.+)$/is)
  if (b64dec) {
    const decoded = b64ToText(b64dec[1])
    if (decoded != null) {
      hits.push({
        id: 'b64-dec',
        label: 'Base64 decode',
        value: decoded,
        description: `${decoded.slice(0, 72)}${decoded.length > 72 ? '…' : ''} — Enter copies`
      })
    }
    return hits
  }

  return hits
}
