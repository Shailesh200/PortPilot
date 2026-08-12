import { useMemo, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'
import DOMPurify from 'dompurify'
import {
  asCsvRows,
  FORMAT_LABELS,
  markdownToHtml,
  type Fmt,
  parse
} from './formatConvertCore'

const SCROLL = 'min-h-0 p-3 text-text-primary'

/** App-themed markdown / rich text (not a printed page). */
const MD_PROSE =
  'prose prose-sm max-w-none prose-invert ' +
  '[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-text-primary ' +
  '[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-text-primary ' +
  '[&_h3]:text-[13.5px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:text-text-primary ' +
  '[&_p]:my-2 [&_p]:text-text-primary ' +
  '[&_li]:text-text-primary [&_strong]:text-text-primary ' +
  '[&_a]:text-accent ' +
  '[&_code]:font-mono [&_code]:text-[12.5px] [&_code]:bg-bg-elevated [&_code]:px-1 [&_code]:rounded [&_code]:text-text-primary ' +
  '[&_pre]:bg-bg-elevated [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-text-primary ' +
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary ' +
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-3 ' +
  '[&_th]:border [&_td]:border [&_th]:border-border-subtle [&_td]:border-border-subtle ' +
  '[&_th]:bg-bg-elevated [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:text-left ' +
  '[&_hr]:border-border-subtle [&_img]:max-w-full [&_img]:rounded-lg'

function valueColor(v: unknown): string {
  if (v === null) return 'text-accent'
  switch (typeof v) {
    case 'string':
      return 'text-success'
    case 'number':
      return 'text-warning'
    case 'boolean':
      return 'text-accent'
    default:
      return 'text-text-primary'
  }
}

function typePill(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array[${v.length}]`
  return typeof v
}

function primitiveText(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function DataTree({
  value,
  name,
  depth = 0
}: {
  value: unknown
  name?: string
  depth?: number
}): ReactNode {
  const isObj = value !== null && typeof value === 'object'
  const [open, setOpen] = useState(depth < 2)
  const entries = isObj
    ? Array.isArray(value)
      ? value.map((v, i) => [String(i), v] as const)
      : Object.entries(value as Record<string, unknown>)
    : []

  const rowClass =
    'flex items-center gap-1.5 py-px px-2 rounded font-mono text-[13px] leading-[1.75] hover:bg-bg-elevated/80'

  if (!isObj) {
    return (
      <div className={rowClass}>
        <span className="w-3" />
        {name != null && (
          <>
            <span className="text-[#7aa2ff]">{name}</span>
            <span className="text-text-secondary">: </span>
          </>
        )}
        <span className={valueColor(value)}>{primitiveText(value)}</span>
        <span className="text-[10px] text-text-muted border border-border-strong rounded-full px-1.5 py-px ml-1">
          {typePill(value)}
        </span>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(rowClass, 'w-full text-left')}
      >
        <span className="text-text-muted text-[10px] w-3 text-center">
          {open ? '▾' : '▸'}
        </span>
        {name != null && <span className="text-[#7aa2ff]">{name}</span>}
        <span className="text-[10px] text-text-muted border border-border-strong rounded-full px-1.5 py-px ml-1">
          {typePill(value)}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-l border-border-subtle pl-1">
          {entries.map(([k, v]) => (
            <DataTree key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function TablePreview({
  rows,
  sheetLabel
}: {
  rows: Record<string, unknown>[]
  sheetLabel?: string
}) {
  if (!rows.length) {
    return <p className="text-[13px] text-text-muted">No rows to preview.</p>
  }
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]

  return (
    <div className="overflow-auto rounded-lg border border-border-subtle bg-bg-card">
      {sheetLabel && (
        <div className="border-b border-border-subtle bg-bg-elevated px-3 py-1.5 text-[11.5px] font-medium text-text-secondary">
          {sheetLabel} · {rows.length} row{rows.length === 1 ? '' : 's'}
        </div>
      )}
      <table className="w-full border-collapse text-[12.5px] font-mono">
        <thead>
          <tr>
            <th className="sticky top-0 z-[1] w-10 bg-bg-elevated border border-border-subtle px-1.5 py-1.5 text-center text-[11px] font-medium text-text-muted">
              #
            </th>
            {keys.map((k) => (
              <th
                key={k}
                className="sticky top-0 z-[1] border border-border-subtle bg-bg-elevated px-2.5 py-1.5 text-left font-medium text-text-secondary whitespace-nowrap"
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-bg-elevated/60">
              <td className="border border-border-subtle bg-bg-elevated/40 px-1.5 py-1.5 text-center text-[11px] text-text-muted">
                {i + 1}
              </td>
              {keys.map((k) => (
                <td
                  key={k}
                  className="border border-border-subtle px-2.5 py-1.5 text-text-primary whitespace-pre-wrap max-w-[20rem] align-top"
                >
                  {formatCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function MarkdownPreviewHtml({ source }: { source: string }) {
  const html = useMemo(() => {
    try {
      const raw = markdownToHtml(source || '')
      return DOMPurify.sanitize(raw, {
        ADD_ATTR: ['target', 'rel']
      })
    } catch (e) {
      return `<p class="text-danger">${
        e instanceof Error ? e.message : 'Markdown render failed'
      }</p>`
    }
  }, [source])

  if (!source.trim()) {
    return <p className="text-[13px] text-text-muted">Nothing to preview.</p>
  }

  return (
    <div className={MD_PROSE} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

function HtmlPreviewPane({ source }: { source: string }) {
  const doc = useMemo(() => {
    const sanitized = DOMPurify.sanitize(source || '', {
      WHOLE_DOCUMENT: /<html[\s>]/i.test(source),
      ADD_ATTR: ['target', 'rel', 'style', 'class']
    })
    const darkCss = `
      html, body {
        background: transparent;
        color: #e8eaed;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        margin: 0;
        padding: 4px 2px;
      }
      a { color: #8b9cff; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: rgba(255,255,255,0.06); }
      code { padding: 0.1em 0.35em; border-radius: 4px; }
      pre { padding: 10px 12px; border-radius: 8px; overflow: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid rgba(255,255,255,0.12); padding: 6px 8px; }
      th { background: rgba(255,255,255,0.06); text-align: left; }
      img { max-width: 100%; }
      blockquote { border-left: 3px solid rgba(255,255,255,0.2); margin: 0.6em 0; padding-left: 12px; color: #b0b3b8; }
    `
    if (/<html[\s>]/i.test(sanitized)) {
      if (/<\/head>/i.test(sanitized)) {
        return sanitized.replace(/<\/head>/i, `<style>${darkCss}</style></head>`)
      }
      return sanitized.replace(
        /<html([^>]*)>/i,
        `<html$1><head><meta charset="utf-8"/><style>${darkCss}</style></head>`
      )
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${darkCss}</style></head><body>${sanitized}</body></html>`
  }, [source])

  if (!source.trim()) {
    return <p className="text-[13px] text-text-muted">Nothing to preview.</p>
  }

  return (
    <iframe
      title="HTML preview"
      sandbox=""
      srcDoc={doc}
      className="block h-[min(70vh,40rem)] w-full rounded-lg border border-border-subtle bg-transparent"
    />
  )
}

function XmlPreview({ text }: { text: string }) {
  // Pretty indentation already comes from stringify; show as themed code block.
  return (
    <pre className="m-0 overflow-auto rounded-lg border border-border-subtle bg-bg-elevated p-3 font-mono text-[12.5px] leading-6 text-text-primary whitespace-pre-wrap break-words">
      {text}
    </pre>
  )
}

function previewModel(
  fmt: Fmt,
  text: string
):
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'markdown'; source: string }
  | { kind: 'html'; source: string }
  | { kind: 'text'; source: string }
  | { kind: 'xml'; source: string }
  | { kind: 'tree'; data: unknown }
  | {
      kind: 'table'
      rows: Record<string, unknown>[]
      sheetLabel?: string
    } {
  if (!text.replace(/^\uFEFF/, '').trim()) return { kind: 'empty' }

  try {
    switch (fmt) {
      case 'md':
      case 'docx':
      case 'pdf':
        // Text fallbacks for document formats (binary PDF/DOCX use dedicated viewers).
        return { kind: 'markdown', source: text }
      case 'html':
        return { kind: 'html', source: text }
      case 'txt':
        return { kind: 'text', source: text }
      case 'xml': {
        // Prefer structured tree when parseable; else formatted source.
        try {
          const data = parse('xml', text)
          if (data !== null && typeof data === 'object') {
            return { kind: 'tree', data }
          }
        } catch {
          /* fall through */
        }
        return { kind: 'xml', source: text }
      }
      case 'csv': {
        const data = parse('csv', text)
        return {
          kind: 'table',
          rows: asCsvRows(data),
          sheetLabel: 'CSV'
        }
      }
      case 'xlsx': {
        try {
          const data = JSON.parse(text.replace(/^\uFEFF/, '').trim())
          return {
            kind: 'table',
            rows: asCsvRows(data),
            sheetLabel: 'Sheet1'
          }
        } catch {
          const data = parse('csv', text)
          return {
            kind: 'table',
            rows: asCsvRows(data),
            sheetLabel: 'Sheet1'
          }
        }
      }
      case 'json':
      case 'yaml':
      case 'toml': {
        const data = parse(fmt, text)
        if (
          Array.isArray(data) &&
          data.length > 0 &&
          data.every(
            (r) => r !== null && typeof r === 'object' && !Array.isArray(r)
          )
        ) {
          return {
            kind: 'table',
            rows: asCsvRows(data),
            sheetLabel: FORMAT_LABELS[fmt]
          }
        }
        return { kind: 'tree', data }
      }
      default:
        return { kind: 'text', source: text }
    }
  } catch (e) {
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : 'Could not render preview'
    }
  }
}

export function FormatPreview({
  fmt,
  text,
  className
}: {
  fmt: Fmt
  text: string
  className?: string
}) {
  const model = useMemo(() => previewModel(fmt, text), [fmt, text])

  return (
    <div className={clsx(SCROLL, className)}>
      {model.kind === 'empty' && (
        <p className="text-[13px] text-text-muted">
          Nothing to preview for {FORMAT_LABELS[fmt]}.
        </p>
      )}
      {model.kind === 'error' && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          <div className="font-medium mb-0.5">Preview failed</div>
          <div className="opacity-90 break-words">{model.message}</div>
          <div className="mt-2 text-[11.5px] text-text-muted">
            Switch to Source to fix the {FORMAT_LABELS[fmt]} content.
          </div>
        </div>
      )}
      {model.kind === 'markdown' && <MarkdownPreviewHtml source={model.source} />}
      {model.kind === 'html' && <HtmlPreviewPane source={model.source} />}
      {model.kind === 'xml' && <XmlPreview text={model.source} />}
      {model.kind === 'text' && (
        <pre className="m-0 font-mono text-[13px] leading-6 whitespace-pre-wrap break-words text-text-primary">
          {model.source}
        </pre>
      )}
      {model.kind === 'tree' && <DataTree value={model.data} />}
      {model.kind === 'table' && (
        <TablePreview rows={model.rows} sheetLabel={model.sheetLabel} />
      )}
    </div>
  )
}
