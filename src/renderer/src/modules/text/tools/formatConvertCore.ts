import * as yaml from 'js-yaml'
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  LevelFormat,
  convertInchesToTwip
} from 'docx'
import { marked, type Token, type Tokens } from 'marked'
import TurndownService from 'turndown'
import { parseCsvRecords, unparseCsv } from '@/lib/csv'
import { getDocument } from '@/lib/pdfjs'
import { rowsFromWorkbook, workbookFromRows } from '@/lib/xlsx'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})

export type Fmt =
  | 'json'
  | 'yaml'
  | 'toml'
  | 'xml'
  | 'csv'
  | 'md'
  | 'txt'
  | 'html'
  | 'docx'
  | 'xlsx'
  | 'pdf'

export const FORMATS: Fmt[] = [
  'json',
  'yaml',
  'toml',
  'xml',
  'csv',
  'md',
  'txt',
  'html',
  'docx',
  'xlsx',
  'pdf'
]

export const FORMAT_LABELS: Record<Fmt, string> = {
  json: 'JSON',
  yaml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  csv: 'CSV',
  md: 'MD',
  txt: 'TXT',
  html: 'HTML',
  docx: 'DOCX',
  xlsx: 'XLSX',
  pdf: 'PDF'
}

export const FORMAT_EXT: Record<Fmt, string> = {
  json: 'json',
  yaml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  csv: 'csv',
  md: 'md',
  txt: 'txt',
  html: 'html',
  docx: 'docx',
  xlsx: 'xlsx',
  pdf: 'pdf'
}

/** Valid output formats for each input (excludes identity). */
export const CONVERSIONS: Record<Fmt, readonly Fmt[]> = {
  json: ['yaml', 'toml', 'xml', 'csv', 'md', 'txt', 'html', 'xlsx', 'docx', 'pdf'],
  yaml: ['json', 'toml', 'xml', 'csv', 'md', 'txt', 'html', 'xlsx', 'docx', 'pdf'],
  toml: ['json', 'yaml', 'xml', 'csv', 'md', 'txt', 'html', 'xlsx', 'docx', 'pdf'],
  xml: ['json', 'yaml', 'toml', 'csv', 'md', 'txt', 'html', 'xlsx', 'docx', 'pdf'],
  csv: ['json', 'yaml', 'toml', 'xml', 'md', 'txt', 'html', 'xlsx', 'docx', 'pdf'],
  // Documents — structured targets added dynamically when content is tabular/object.
  md: ['txt', 'html', 'docx', 'pdf'],
  txt: ['md', 'html', 'docx', 'pdf'],
  html: ['md', 'txt', 'docx', 'pdf'],
  docx: ['md', 'txt', 'html', 'pdf'],
  xlsx: ['csv', 'json', 'yaml', 'md', 'xml', 'txt', 'html', 'pdf'],
  pdf: ['txt', 'md', 'html', 'docx']
}

const STRUCTURED_TARGETS: Fmt[] = [
  'json',
  'yaml',
  'csv',
  'xml',
  'xlsx',
  'toml'
]

function isStructuredData(data: unknown): boolean {
  if (data == null) return false
  if (typeof data === 'string') return false
  if (typeof data === 'number' || typeof data === 'boolean') return true
  if (Array.isArray(data)) return true
  if (typeof data === 'object') return true
  return false
}

function uniqueFmts(list: Fmt[]): Fmt[] {
  return [...new Set(list)]
}

/**
 * Output formats allowed for the current input.
 * For MD/DOCX/TXT, JSON/YAML/CSV/… appear only when the content is structured
 * (markdown table, frontmatter object, fenced JSON/YAML, etc.).
 */
export function targetsFor(from: Fmt, inputText?: string): Fmt[] {
  const base = [...CONVERSIONS[from]]
  const text = inputText?.replace(/^\uFEFF/, '').trim() ?? ''

  if (from === 'md' || from === 'docx' || from === 'html' || from === 'pdf') {
    if (!text) return base
    try {
      const data = parse(from, text)
      if (isStructuredData(data)) {
        return uniqueFmts([
          ...base,
          ...STRUCTURED_TARGETS.filter((f) => f !== from)
        ])
      }
    } catch {
      /* keep document targets only */
    }
    return base
  }

  if (from === 'txt' && text) {
    const extra: Fmt[] = []
    try {
      JSON.parse(text)
      extra.push('json', 'yaml')
    } catch {
      try {
        const v = yaml.load(text)
        if (v !== undefined && typeof v === 'object') extra.push('yaml', 'json')
      } catch {
        /* plain text */
      }
    }
    return uniqueFmts([...base, ...extra])
  }

  return base
}

export function pickValidTo(
  from: Fmt,
  current: Fmt,
  inputText?: string
): Fmt {
  const targets = targetsFor(from, inputText)
  if (targets.includes(current)) return current
  return targets[0] ?? 'txt'
}

export function guessFmt(filename: string): Fmt | null {
  const n = filename.toLowerCase()
  if (n.endsWith('.json')) return 'json'
  if (n.endsWith('.yaml') || n.endsWith('.yml')) return 'yaml'
  if (n.endsWith('.toml')) return 'toml'
  if (n.endsWith('.xml')) return 'xml'
  if (n.endsWith('.csv') || n.endsWith('.tsv')) return 'csv'
  if (n.endsWith('.md') || n.endsWith('.markdown')) return 'md'
  if (n.endsWith('.txt') || n.endsWith('.text')) return 'txt'
  if (n.endsWith('.html') || n.endsWith('.htm')) return 'html'
  if (n.endsWith('.docx')) return 'docx'
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) return 'xlsx'
  if (n.endsWith('.pdf')) return 'pdf'
  if (n.endsWith('.doc')) return null // legacy Word — not supported
  return null
}

export function isLegacyDoc(filename: string): boolean {
  return filename.toLowerCase().endsWith('.doc') && !filename.toLowerCase().endsWith('.docx')
}

export function isBinaryFmt(fmt: Fmt): boolean {
  return fmt === 'docx' || fmt === 'xlsx' || fmt === 'pdf'
}

export function editorLanguageFmt(fmt: Fmt): Fmt {
  if (fmt === 'docx' || fmt === 'pdf') return 'md'
  if (fmt === 'xlsx') return 'json'
  return fmt
}

function csvDelimiter(text: string, filename?: string): string {
  if (filename?.toLowerCase().endsWith('.tsv')) return '\t'
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  if (first.includes('\t') && !first.includes(',')) return '\t'
  return ','
}

function asTomlRoot(data: unknown): Record<string, unknown> {
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  if (Array.isArray(data)) return { items: data }
  return { value: data as string | number | boolean | null }
}

function asXmlRoot(data: unknown): unknown {
  if (Array.isArray(data)) return { item: data }
  if (data !== null && typeof data === 'object') return data
  return { value: data }
}

export function flattenRow(
  row: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenRow(v as Record<string, unknown>, key))
    } else if (Array.isArray(v)) {
      const primitives = v.every((x) => x === null || typeof x !== 'object')
      out[key] = primitives ? v.join(';') : JSON.stringify(v)
    } else {
      out[key] = v
    }
  }
  return out
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isObjectRowArray(v: unknown): v is Record<string, unknown>[] {
  if (!Array.isArray(v)) return false
  if (v.length === 0) return true
  const objects = v.filter(isPlainObject).length
  return objects >= Math.ceil(v.length * 0.5)
}

export function asCsvRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return []

  if (Array.isArray(data)) {
    if (data.length === 0) return []
    if (data.every((x) => x === null || typeof x !== 'object')) {
      return data.map((value) => ({ value }))
    }
    return data.map((row) => {
      if (isPlainObject(row)) return flattenRow(row)
      if (Array.isArray(row)) return { value: JSON.stringify(row) }
      return { value: row }
    })
  }

  if (isPlainObject(data)) {
    const candidates = Object.entries(data).filter(([, v]) =>
      isObjectRowArray(v)
    ) as [string, Record<string, unknown>[]][]
    if (candidates.length > 0) {
      candidates.sort((a, b) => b[1].length - a[1].length)
      return asCsvRows(candidates[0][1])
    }
    return [flattenRow(data)]
  }

  return [{ value: data }]
}

function splitMdRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function isMdSeparator(line: string): boolean {
  const cells = splitMdRow(line)
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, '')))
  )
}

function parseMdTable(text: string): Record<string, unknown>[] | null {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) return null

  let headerIdx = -1
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].includes('|') && isMdSeparator(lines[i + 1])) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) return null

  const headers = splitMdRow(lines[headerIdx]).map((h, i) => h || `col${i + 1}`)
  if (!headers.length) return null

  const rows: Record<string, unknown>[] = []
  for (let i = headerIdx + 2; i < lines.length; i++) {
    if (!lines[i].includes('|')) break
    const cells = splitMdRow(lines[i])
    if (cells.every((c) => !c)) continue
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? ''
    })
    rows.push(row)
  }
  return rows.length ? rows : null
}

function parseMdFrontmatter(text: string): {
  meta: unknown
  body: string
} | null {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/)
  if (!m) return null
  try {
    const meta = yaml.load(m[1])
    return { meta: meta === undefined ? null : meta, body: (m[2] ?? '').trim() }
  } catch {
    return null
  }
}

export function parseMarkdown(text: string): unknown {
  const fm = parseMdFrontmatter(text)
  if (fm) {
    const table = fm.body ? parseMdTable(fm.body) : null
    if (isPlainObject(fm.meta)) {
      if (table) return { ...fm.meta, rows: table }
      if (fm.body) return { ...fm.meta, content: fm.body }
      return fm.meta
    }
    if (table) return table
    if (fm.meta !== null && fm.meta !== undefined) return fm.meta
  }

  const table = parseMdTable(text)
  if (table) return table

  const fence = text.match(
    /^```(?:json|yaml|yml)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i
  )
  if (fence) {
    const inner = fence[1].trim()
    try {
      return JSON.parse(inner)
    } catch {
      /* try yaml */
    }
    try {
      const v = yaml.load(inner)
      if (v !== undefined) return v
    } catch {
      /* fall through */
    }
  }

  return text
}

function escapeMdCell(v: unknown): string {
  return String(v ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
}

function toMdTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  if (!keys.length) return ''
  const header = `| ${keys.join(' | ')} |`
  const sep = `| ${keys.map(() => '---').join(' | ')} |`
  const body = rows
    .map((r) => `| ${keys.map((k) => escapeMdCell(r[k])).join(' | ')} |`)
    .join('\n')
  return `${header}\n${sep}\n${body}\n`
}

export function stringifyMarkdown(data: unknown): string {
  if (typeof data === 'string') return data
  if (data === null || data === undefined) return ''

  if (Array.isArray(data) && isObjectRowArray(data)) {
    return toMdTable(asCsvRows(data))
  }

  if (isPlainObject(data)) {
    const hasRowArray = Object.values(data).some(isObjectRowArray)
    if (hasRowArray) return toMdTable(asCsvRows(data))

    const allScalar = Object.values(data).every(
      (v) => v === null || typeof v !== 'object'
    )
    if (allScalar) {
      return (
        Object.entries(data)
          .map(([k, v]) => `- **${k}**: ${String(v)}`)
          .join('\n') + '\n'
      )
    }
  }

  return `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`
}

function stringifyText(data: unknown): string {
  if (typeof data === 'string') return data
  if (data === null || data === undefined) return ''
  if (typeof data === 'number' || typeof data === 'boolean') return String(data)
  try {
    return yaml.dump(data, { lineWidth: -1 })
  } catch {
    return JSON.stringify(data, null, 2)
  }
}

/** Working-text representation for the editor / copy / preview. */
export function parse(fmt: Fmt, text: string, filename?: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return null

  switch (fmt) {
    case 'json':
    case 'xlsx':
      return JSON.parse(trimmed)
    case 'yaml': {
      const v = yaml.load(trimmed)
      return v === undefined ? null : v
    }
    case 'toml':
      return parseToml(trimmed)
    case 'xml':
      return new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text'
      }).parse(trimmed)
    case 'csv': {
      return parseCsvRecords(trimmed, csvDelimiter(trimmed, filename))
    }
    case 'md':
    case 'docx':
    case 'pdf':
      return parseMarkdown(trimmed)
    case 'html':
      return parseMarkdown(htmlToMarkdown(trimmed))
    case 'txt':
      return text.replace(/^\uFEFF/, '')
  }
}

export function htmlToMarkdown(html: string): string {
  const cleaned = html.replace(/^\uFEFF/, '').trim()
  if (!cleaned) return ''
  try {
    return turndown.turndown(cleaned)
  } catch {
    return cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rowsToHtmlTable(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '<p><em>Empty table</em></p>'
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const head = keys.map((k) => `<th>${escapeHtml(k)}</th>`).join('')
  const body = rows
    .map(
      (r) =>
        `<tr>${keys
          .map((k) => `<td>${escapeHtml(String(r[k] ?? ''))}</td>`)
          .join('')}</tr>`
    )
    .join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** Convert parsed data into an HTML fragment (not a full document). */
export function stringifyHtml(data: unknown): string {
  if (data === null || data === undefined) return ''
  if (typeof data === 'string') {
    const md = data.trim()
    if (!md) return ''
    // Prose / markdown source → HTML
    try {
      return markdownToHtml(md)
    } catch {
      return `<pre>${escapeHtml(data)}</pre>`
    }
  }
  if (Array.isArray(data) && isObjectRowArray(data)) {
    return rowsToHtmlTable(asCsvRows(data))
  }
  if (isPlainObject(data)) {
    const hasRowArray = Object.values(data).some(isObjectRowArray)
    if (hasRowArray) return rowsToHtmlTable(asCsvRows(data))
  }
  return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`
}

const PRINT_CSS = `
  @page { margin: 0.75in; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #111;
  }
  h1, h2, h3, h4 { margin: 1.1em 0 0.4em; line-height: 1.25; font-weight: 650; }
  h1 { font-size: 1.6em; } h2 { font-size: 1.35em; } h3 { font-size: 1.15em; }
  p, ul, ol, pre, blockquote, table { margin: 0.6em 0; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.2em 0; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
  pre { background: #f4f4f5; padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; }
  code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 4px; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #ccc; padding-left: 12px; color: #444; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f4f4f5; }
  a { color: #0b57d0; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.2em 0; }
`

marked.setOptions({ gfm: true, breaks: false })

export function markdownToHtml(source: string): string {
  return marked.parse(source || '', { async: false }) as string
}

/** Full HTML document suitable for print / PDF. */
export function contentToPrintableHtml(opts: {
  from: Fmt
  input: string
  data: unknown
}): string {
  const { from, input, data } = opts
  let body: string

  if (from === 'html') {
    const raw = input.replace(/^\uFEFF/, '').trim()
    if (/<html[\s>]/i.test(raw) || /<body[\s>]/i.test(raw)) {
      // Caller already has a document — still wrap styles if missing
      if (/<style[\s>]/i.test(raw) || /<\/head>/i.test(raw)) return raw
      return raw.replace(
        /<\/head>/i,
        `<style>${PRINT_CSS}</style></head>`
      )
    }
    body = raw
  } else if (from === 'md' || from === 'docx' || from === 'pdf') {
    body = stringifyHtml(input)
  } else if (from === 'txt') {
    body = `<pre>${escapeHtml(input.replace(/^\uFEFF/, ''))}</pre>`
  } else {
    body = stringifyHtml(data)
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>PortPilot export</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`
}

export function stringify(fmt: Fmt, data: unknown): string {
  if (data === null || data === undefined) return ''

  switch (fmt) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'yaml':
      return yaml.dump(data, { lineWidth: -1 })
    case 'toml':
      return stringifyToml(asTomlRoot(data))
    case 'xml':
      return new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        format: true
      }).build(asXmlRoot(data))
    case 'csv':
      return unparseCsv(asCsvRows(data))
    case 'md':
    case 'docx':
    case 'pdf':
      // PDF binary is built via printToPDF; editor shows markdown preview text.
      return stringifyMarkdown(data)
    case 'html':
      return stringifyHtml(data)
    case 'txt':
      return stringifyText(data)
    case 'xlsx':
      // Preview as CSV in the output pane; binary XLSX on download.
      return unparseCsv(asCsvRows(data))
  }
}

function headingLevel(depth: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  switch (depth) {
    case 1:
      return HeadingLevel.HEADING_1
    case 2:
      return HeadingLevel.HEADING_2
    case 3:
      return HeadingLevel.HEADING_3
    case 4:
      return HeadingLevel.HEADING_4
    case 5:
      return HeadingLevel.HEADING_5
    default:
      return HeadingLevel.HEADING_6
  }
}

type InlineOpts = { bold?: boolean; italics?: boolean; code?: boolean }

function inlineRuns(
  tokens: Token[] | undefined,
  opts: InlineOpts = {}
): TextRun[] {
  if (!tokens?.length) return [new TextRun({ text: '', ...opts })]
  const runs: TextRun[] = []

  const pushText = (text: string, extra: InlineOpts = {}) => {
    if (!text) return
    runs.push(
      new TextRun({
        text,
        bold: extra.bold || opts.bold,
        italics: extra.italics || opts.italics,
        font: extra.code || opts.code ? 'Courier New' : undefined,
        size: extra.code || opts.code ? 20 : undefined
      })
    )
  }

  for (const t of tokens) {
    switch (t.type) {
      case 'text':
        pushText((t as Tokens.Text).text)
        break
      case 'strong':
        runs.push(
          ...inlineRuns((t as Tokens.Strong).tokens, { ...opts, bold: true })
        )
        break
      case 'em':
        runs.push(
          ...inlineRuns((t as Tokens.Em).tokens, { ...opts, italics: true })
        )
        break
      case 'codespan':
        pushText((t as Tokens.Codespan).text, { code: true })
        break
      case 'link': {
        const link = t as Tokens.Link
        const label = link.text || link.href
        runs.push(
          new TextRun({
            text: label,
            color: '6366F1',
            underline: {}
          })
        )
        if (link.href && link.href !== label) {
          pushText(` (${link.href})`)
        }
        break
      }
      case 'escape':
        pushText((t as Tokens.Escape).text)
        break
      case 'br':
        pushText('\n')
        break
      case 'del':
        runs.push(
          new TextRun({
            text: (t as Tokens.Del).text,
            strike: true,
            bold: opts.bold,
            italics: opts.italics
          })
        )
        break
      default:
        if ('text' in t && typeof (t as { text?: string }).text === 'string') {
          pushText((t as { text: string }).text)
        } else if ('tokens' in t) {
          runs.push(
            ...inlineRuns(
              (t as { tokens?: Token[] }).tokens,
              opts
            )
          )
        }
        break
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })]
}

const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'CBD5E1'
}
const tableBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
  insideHorizontal: thinBorder,
  insideVertical: thinBorder
}

function cellParagraphs(cell: Tokens.TableCell, header: boolean): Paragraph[] {
  return [
    new Paragraph({
      children: inlineRuns(cell.tokens, { bold: header })
    })
  ]
}

function tableFromToken(token: Tokens.Table): Table {
  const colCount = Math.max(token.header.length, 1)
  const width = Math.floor(9026 / colCount)
  const headerRow = new TableRow({
    children: token.header.map(
      (cell) =>
        new TableCell({
          borders: tableBorders,
          width: { size: width, type: WidthType.DXA },
          children: cellParagraphs(cell, true)
        })
    )
  })
  const bodyRows = token.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders: tableBorders,
              width: { size: width, type: WidthType.DXA },
              children: cellParagraphs(cell, false)
            })
        )
      })
  )
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    rows: [headerRow, ...bodyRows]
  })
}

type DocChild = Paragraph | Table

function blocksFromTokens(tokens: Token[], listRef?: string): DocChild[] {
  const out: DocChild[] = []

  for (const token of tokens) {
    switch (token.type) {
      case 'space':
        break
      case 'heading': {
        const h = token as Tokens.Heading
        out.push(
          new Paragraph({
            heading: headingLevel(h.depth),
            spacing: { before: 240, after: 120 },
            children: inlineRuns(h.tokens)
          })
        )
        break
      }
      case 'paragraph': {
        const p = token as Tokens.Paragraph
        out.push(
          new Paragraph({
            spacing: { after: 120 },
            children: inlineRuns(p.tokens)
          })
        )
        break
      }
      case 'blockquote': {
        const q = token as Tokens.Blockquote
        for (const inner of q.tokens) {
          if (inner.type === 'paragraph') {
            out.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.25) },
                border: {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 24,
                    color: '94A3B8',
                    space: 12
                  }
                },
                spacing: { after: 120 },
                children: inlineRuns((inner as Tokens.Paragraph).tokens)
              })
            )
          } else {
            out.push(...blocksFromTokens([inner]))
          }
        }
        break
      }
      case 'list': {
        const list = token as Tokens.List
        const reference = list.ordered ? 'md-numbered' : 'md-bullets'
        list.items.forEach((item, index) => {
          const itemTokens = item.tokens ?? []
          // Prefer inline text from first paragraph/text token
          let runs: TextRun[] = []
          for (const it of itemTokens) {
            if (it.type === 'paragraph') {
              runs = inlineRuns((it as Tokens.Paragraph).tokens)
              break
            }
            if (it.type === 'text') {
              runs = inlineRuns((it as Tokens.Text).tokens ?? [it])
              break
            }
          }
          if (!runs.length) {
            runs = [new TextRun({ text: item.text || '' })]
          }
          out.push(
            new Paragraph({
              numbering: { reference, level: 0 },
              spacing: { after: 60 },
              children: runs
            })
          )
          // Nested blocks after the first line
          const rest = itemTokens.filter(
            (it, i) =>
              !(i === 0 && (it.type === 'paragraph' || it.type === 'text'))
          )
          if (rest.length) {
            out.push(...blocksFromTokens(rest, reference))
          }
          void index
        })
        break
      }
      case 'code': {
        const c = token as Tokens.Code
        const lines = (c.text || '').split('\n')
        for (const line of lines) {
          out.push(
            new Paragraph({
              shading: { fill: 'F1F5F9' },
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: line || ' ',
                  font: 'Courier New',
                  size: 18
                })
              ]
            })
          )
        }
        out.push(new Paragraph({ children: [] }))
        break
      }
      case 'table':
        out.push(tableFromToken(token as Tokens.Table))
        out.push(new Paragraph({ children: [] }))
        break
      case 'hr':
        out.push(
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: 'CBD5E1',
                space: 8
              }
            },
            spacing: { before: 120, after: 120 },
            children: []
          })
        )
        break
      case 'html': {
        const html = token as Tokens.HTML
        out.push(
          new Paragraph({
            children: [new TextRun({ text: html.text || html.raw || '' })]
          })
        )
        break
      }
      default:
        if ('tokens' in token && Array.isArray((token as { tokens?: Token[] }).tokens)) {
          out.push(
            ...blocksFromTokens((token as { tokens: Token[] }).tokens, listRef)
          )
        } else if ('text' in token) {
          out.push(
            new Paragraph({
              children: [
                new TextRun({ text: String((token as { text: string }).text) })
              ]
            })
          )
        }
        break
    }
  }

  return out
}

async function markdownToDocx(markdown: string): Promise<Uint8Array> {
  const tokens = marked.lexer(markdown || '')
  const children = blocksFromTokens(tokens)
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }
        },
        heading1: {
          run: { size: 32, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 280, after: 160 } }
        },
        heading2: {
          run: { size: 28, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 240, after: 120 } }
        },
        heading3: {
          run: { size: 24, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 200, after: 100 } }
        },
        heading4: {
          run: { size: 22, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 180, after: 80 } }
        },
        heading5: {
          run: { size: 22, bold: true, italics: true, font: 'Calibri' },
          paragraph: { spacing: { before: 160, after: 80 } }
        },
        heading6: {
          run: { size: 20, bold: true, italics: true, font: 'Calibri' },
          paragraph: { spacing: { before: 140, after: 60 } }
        }
      }
    },
    numbering: {
      config: [
        {
          reference: 'md-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.18) }
                }
              }
            }
          ]
        },
        {
          reference: 'md-numbered',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertInchesToTwip(0.35), hanging: convertInchesToTwip(0.18) }
                }
              }
            }
          ]
        }
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1)
            }
          }
        },
        children: children.length
          ? children
          : [new Paragraph({ children: [new TextRun({ text: '' })] })]
      }
    ]
  })
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

export async function buildBinary(
  fmt: 'docx' | 'xlsx',
  data: unknown,
  opts?: { markdownSource?: string }
): Promise<Uint8Array> {
  if (fmt === 'xlsx') {
    return workbookFromRows(asCsvRows(data))
  }

  const md =
    opts?.markdownSource?.trim() ||
    (typeof data === 'string' ? data : stringifyMarkdown(data))
  return markdownToDocx(md)
}

export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  const loadingTask = getDocument({ data: new Uint8Array(data) })
  const pdf = await loadingTask.promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .join(' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
    if (line) parts.push(line)
  }
  return parts.join('\n\n').trim()
}

export async function importOfficeFile(
  file: File
): Promise<{ fmt: Fmt; text: string; bytes?: Uint8Array }> {
  const name = file.name
  if (isLegacyDoc(name)) {
    throw new Error(
      'Legacy .doc is not supported. Open it in Word and save as .docx, then import again.'
    )
  }

  const fmt = guessFmt(name)
  if (fmt === 'docx') {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf.slice(0))
    const mammoth = await import('mammoth')
    const convertToMarkdown = (
      mammoth as unknown as {
        convertToMarkdown: (input: {
          arrayBuffer: ArrayBuffer
        }) => Promise<{ value: string }>
      }
    ).convertToMarkdown
    const result = await convertToMarkdown({
      arrayBuffer: buf
    })
    return { fmt: 'docx', text: result.value || '', bytes }
  }

  if (fmt === 'xlsx') {
    const buf = await file.arrayBuffer()
    const rows = await rowsFromWorkbook(buf)
    return { fmt: 'xlsx', text: JSON.stringify(rows, null, 2) }
  }

  if (fmt === 'pdf') {
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf.slice(0))
    let text = ''
    try {
      text = await extractPdfText(buf)
    } catch {
      /* scanned / protected — still allow visual preview */
    }
    return { fmt: 'pdf', text, bytes }
  }

  throw new Error('Not an Office file')
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}
