export type RegexKind =
  | 'anchor'
  | 'meta'
  | 'quant'
  | 'charclass'
  | 'group'
  | 'escape'
  | 'literal'
  | 'alt'

export type RegexNode = {
  id: string
  start: number
  end: number
  text: string
  kind: RegexKind
  title: string
  detail: string
  children?: RegexNode[]
  quant?: { text: string; title: string }
}

export const TOKEN_CLASS: Record<RegexKind, string> = {
  meta: 'text-accent',
  quant: 'text-warning',
  charclass: 'text-info',
  group: 'text-success',
  anchor: 'text-accent',
  escape: 'text-warning',
  literal: 'text-text-primary',
  alt: 'text-accent'
}

type Ctx = { src: string; i: number; id: number }

function peek(ctx: Ctx): string {
  return ctx.src[ctx.i] ?? ''
}

function nid(ctx: Ctx): string {
  ctx.id += 1
  return `n${ctx.id}`
}

function escapeName(ch: string): string {
  switch (ch) {
    case 'd':
      return 'a digit (0–9)'
    case 'D':
      return 'a non-digit'
    case 'w':
      return 'a word character [A-Za-z0-9_]'
    case 'W':
      return 'a non-word character'
    case 's':
      return 'whitespace'
    case 'S':
      return 'a non-whitespace character'
    case 'b':
      return 'a word boundary'
    case 'B':
      return 'a non-word-boundary'
    case 'n':
      return 'a newline'
    case 't':
      return 'a tab'
    case 'r':
      return 'a carriage return'
    default:
      return `the literal character “${ch}”`
  }
}

function describeClass(body: string): { title: string; detail: string } {
  const negated = body.startsWith('^')
  const inner = negated ? body.slice(1) : body
  const parts: string[] = []
  let i = 0
  while (i < inner.length) {
    if (inner[i] === '\\' && i + 1 < inner.length) {
      parts.push(escapeName(inner[i + 1]))
      i += 2
      continue
    }
    if (i + 2 < inner.length && inner[i + 1] === '-' && inner[i + 2] !== ']') {
      parts.push(`${inner[i]}–${inner[i + 2]}`)
      i += 3
      continue
    }
    const ch = inner[i]
    parts.push(ch === ' ' ? 'space' : `“${ch}”`)
    i += 1
  }
  const list = parts.length ? parts.join(', ') : 'empty set'
  return {
    title: negated ? 'Negated character set' : 'Character set',
    detail: negated
      ? `Match a character that is not in: ${list}`
      : `Match a character in: ${list}`
  }
}

function parseQuant(ctx: Ctx): { text: string; title: string } | undefined {
  const ch = peek(ctx)
  let text = ''
  let title = ''
  if (ch === '*' || ch === '+' || ch === '?') {
    text = ch
    ctx.i += 1
    title =
      ch === '*'
        ? 'zero or more times'
        : ch === '+'
          ? 'one or more times'
          : 'optional (zero or one time)'
  } else if (ch === '{') {
    const m = ctx.src.slice(ctx.i).match(/^\{(\d+)(,(\d*))?\}/)
    if (!m) return undefined
    text = m[0]
    ctx.i += m[0].length
    if (!m[2]) title = `exactly ${m[1]} times`
    else if (!m[3]) title = `${m[1]} or more times`
    else title = `${m[1]} to ${m[3]} times`
  } else {
    return undefined
  }
  if (peek(ctx) === '?') {
    text += '?'
    ctx.i += 1
    title += ', lazy'
  }
  return { text, title }
}

function parseClass(ctx: Ctx): RegexNode {
  const start = ctx.i
  ctx.i += 1 // [
  let body = ''
  if (peek(ctx) === '^') {
    body += '^'
    ctx.i += 1
  }
  while (ctx.i < ctx.src.length) {
    const ch = ctx.src[ctx.i]
    if (ch === ']' && body.length > 0 && body !== '^') break
    if (ch === '\\' && ctx.i + 1 < ctx.src.length) {
      body += ctx.src.slice(ctx.i, ctx.i + 2)
      ctx.i += 2
      continue
    }
    body += ch
    ctx.i += 1
  }
  if (peek(ctx) === ']') ctx.i += 1
  const desc = describeClass(body)
  const end = ctx.i
  return {
    id: nid(ctx),
    start,
    end,
    text: ctx.src.slice(start, end),
    kind: 'charclass',
    title: desc.title,
    detail: desc.detail
  }
}

function parseGroup(ctx: Ctx): RegexNode {
  const start = ctx.i
  ctx.i += 1 // (
  let kindLabel = 'Capturing group'
  let detail = 'Group the tokens together and capture the match'
  if (ctx.src.startsWith('?:', ctx.i)) {
    ctx.i += 2
    kindLabel = 'Non-capturing group'
    detail = 'Group the tokens without capturing'
  } else if (ctx.src.startsWith('?=', ctx.i)) {
    ctx.i += 2
    kindLabel = 'Positive lookahead'
    detail = 'Assert that what follows matches, without consuming it'
  } else if (ctx.src.startsWith('?!', ctx.i)) {
    ctx.i += 2
    kindLabel = 'Negative lookahead'
    detail = 'Assert that what follows does not match'
  } else if (ctx.src.startsWith('?<=', ctx.i)) {
    ctx.i += 3
    kindLabel = 'Positive lookbehind'
    detail = 'Assert that what precedes matches'
  } else if (ctx.src.startsWith('?<!', ctx.i)) {
    ctx.i += 3
    kindLabel = 'Negative lookbehind'
    detail = 'Assert that what precedes does not match'
  } else if (ctx.src.startsWith('?<', ctx.i)) {
    const m = ctx.src.slice(ctx.i).match(/^\?<([^>]+)>/)
    if (m) {
      ctx.i += m[0].length
      kindLabel = `Named group “${m[1]}”`
      detail = `Capture this match as “${m[1]}”`
    }
  }
  const children = parseAlt(ctx)
  if (peek(ctx) === ')') ctx.i += 1
  return {
    id: nid(ctx),
    start,
    end: ctx.i,
    text: ctx.src.slice(start, ctx.i),
    kind: 'group',
    title: kindLabel,
    detail,
    children
  }
}

function parseAtom(ctx: Ctx): RegexNode | null {
  if (ctx.i >= ctx.src.length) return null
  const ch = peek(ctx)
  if (ch === '|' || ch === ')') return null
  const start = ctx.i

  if (ch === '^' || ch === '$') {
    ctx.i += 1
    return {
      id: nid(ctx),
      start,
      end: ctx.i,
      text: ch,
      kind: 'anchor',
      title: ch === '^' ? 'Beginning' : 'End',
      detail:
        ch === '^'
          ? 'Match at the start of the string (or line, when /m is on)'
          : 'Match at the end of the string (or line, when /m is on)'
    }
  }
  if (ch === '.') {
    ctx.i += 1
    return {
      id: nid(ctx),
      start,
      end: ctx.i,
      text: '.',
      kind: 'meta',
      title: 'Any character',
      detail: 'Match any character except newline (unless /s is on)'
    }
  }
  if (ch === '\\') {
    const next = ctx.src[ctx.i + 1] ?? ''
    ctx.i += next ? 2 : 1
    const word = next === 'b' || next === 'B'
    return {
      id: nid(ctx),
      start,
      end: ctx.i,
      text: ctx.src.slice(start, ctx.i),
      kind: word ? 'anchor' : 'escape',
      title: word ? 'Word boundary' : 'Escaped token',
      detail: escapeName(next || '\\')
    }
  }
  if (ch === '[') return parseClass(ctx)
  if (ch === '(') return parseGroup(ctx)

  while (ctx.i < ctx.src.length) {
    const c = peek(ctx)
    if ('^$.*+?()[]{}|\\'.includes(c)) break
    ctx.i += 1
  }
  const text = ctx.src.slice(start, ctx.i)
  if (!text) {
    ctx.i += 1
    return {
      id: nid(ctx),
      start,
      end: ctx.i,
      text: ctx.src.slice(start, ctx.i),
      kind: 'literal',
      title: 'Literal',
      detail: `Match “${ctx.src[start]}”`
    }
  }
  return {
    id: nid(ctx),
    start,
    end: ctx.i,
    text,
    kind: 'literal',
    title: 'Literal',
    detail:
      text.length === 1
        ? `Match the character “${text}”`
        : `Match the characters “${text}”`
  }
}

function parseSeq(ctx: Ctx): RegexNode[] {
  const out: RegexNode[] = []
  while (ctx.i < ctx.src.length && peek(ctx) !== '|' && peek(ctx) !== ')') {
    const atom = parseAtom(ctx)
    if (!atom) break
    const quant = parseQuant(ctx)
    if (quant) {
      atom.quant = quant
      atom.end = ctx.i
      atom.text = ctx.src.slice(atom.start, atom.end)
      atom.detail = `${atom.detail} — ${quant.title}`
    }
    out.push(atom)
  }
  return out
}

function parseAlt(ctx: Ctx): RegexNode[] {
  const first = parseSeq(ctx)
  if (peek(ctx) !== '|') return first
  const branches: RegexNode[][] = [first]
  while (peek(ctx) === '|') {
    const start = ctx.i
    ctx.i += 1
    const seq = parseSeq(ctx)
    seq.unshift({
      id: nid(ctx),
      start,
      end: start + 1,
      text: '|',
      kind: 'alt',
      title: 'Alternation',
      detail: 'Match either the expression before or after'
    })
    branches.push(seq)
  }
  return branches.flat()
}

/** Parse a pattern into nested explanation nodes (regexr-style). */
export function explainRegex(pattern: string): RegexNode[] {
  if (!pattern) return []
  return parseAlt({ src: pattern, i: 0, id: 0 })
}

export function walkNodes(
  nodes: RegexNode[],
  visit: (n: RegexNode) => void
): void {
  for (const n of nodes) {
    visit(n)
    if (n.children) walkNodes(n.children, visit)
  }
}
