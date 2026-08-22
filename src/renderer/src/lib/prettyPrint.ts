/** Lightweight pretty-printers. Repeated calls are stable (idempotent). */

export function prettyHtml(input: string, indentSize = 2): string {
  const pad = ' '.repeat(indentSize)
  const tokens = input
    .replace(/>\s+</g, '><')
    .replace(/(<\/?[a-zA-Z][^>]*>)/g, '\n$1\n')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
  let depth = 0
  const out: string[] = []
  for (const t of tokens) {
    const closing = /^<\//.test(t)
    const self = /\/>$/.test(t) || /^<!/.test(t) || /^<\?/.test(t)
    const opening = /^<[a-zA-Z]/.test(t) && !self && !closing
    if (closing) depth = Math.max(0, depth - 1)
    out.push(pad.repeat(depth) + t)
    if (opening && !/<\/[a-zA-Z]/.test(t)) depth += 1
  }
  return out.join('\n')
}

function withOpenBrace(buf: string): string {
  const before = buf.replace(/\s+$/g, '').trimEnd()
  return before ? `${before} {` : '{'
}

export function prettyCss(input: string, indentSize = 2): string {
  const pad = ' '.repeat(indentSize)
  let depth = 0
  let buf = ''
  const out: string[] = []
  const flush = () => {
    const t = buf.trim()
    if (t) out.push(pad.repeat(depth) + t)
    buf = ''
  }
  for (const ch of input) {
    if (ch === '{') {
      buf = withOpenBrace(buf)
      flush()
      depth += 1
    } else if (ch === '}') {
      flush()
      depth = Math.max(0, depth - 1)
      out.push(pad.repeat(depth) + '}')
    } else if (ch === ';') {
      buf += ';'
      flush()
    } else buf += ch
  }
  flush()
  return out.join('\n')
}

export function prettyLog(input: string): string {
  return input
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim()
      if (!t) return ''
      if (
        (t.startsWith('{') && t.endsWith('}')) ||
        (t.startsWith('[') && t.endsWith(']'))
      ) {
        try {
          return JSON.stringify(JSON.parse(t), null, 2)
        } catch {
          return line
        }
      }
      return line
    })
    .join('\n')
}

export function prettyJs(input: string, indentSize = 2): string {
  const pad = ' '.repeat(indentSize)
  let depth = 0
  let buf = ''
  const out: string[] = []
  let str: '"' | "'" | '`' | null = null
  const flush = (extra = '') => {
    const t = (buf + extra).trim()
    if (t) out.push(pad.repeat(Math.max(0, depth)) + t)
    buf = ''
  }
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const prev = input[i - 1]
    if (str) {
      buf += ch
      if (ch === str && prev !== '\\') str = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      str = ch
      buf += ch
      continue
    }
    if (ch === '{') {
      buf = withOpenBrace(buf)
      flush()
      depth += 1
    } else if (ch === '}') {
      flush()
      depth = Math.max(0, depth - 1)
      out.push(pad.repeat(depth) + '}')
    } else if (ch === ';') {
      buf += ';'
      flush()
    } else buf += ch
  }
  flush()
  return out.join('\n')
}
