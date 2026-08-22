import { useEffect, useMemo, useState } from 'react'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import { useHandoffPayload } from '../../../hooks/useHandoffPayload'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import {
  ToolBadge,
  ToolPane,
  ToolSeg,
  ToolToolbar
} from './toolUi'
import { ToolFullscreenShell } from './ToolWorkspaceExtras'
import { SplitPane } from '../../../shell/SplitPane'
import { ToolMonoTextarea, ToolPasteCopy } from './toolChrome'
import {
  CodePane,
  highlightCurl,
  highlightFetch
} from '../../../lib/syntaxHighlight'

type OutKind = 'curl' | 'fetch' | 'url'

type ParsedRequest = {
  method: string
  url: string
  headers: [string, string][]
  query: [string, string][]
  body: string
}

function splitArgs(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (/\s/.test(ch)) {
      if (cur) out.push(cur)
      cur = ''
      continue
    }
    if (ch === '\\' && i + 1 < line.length) {
      cur += line[++i]
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

function parseUrl(raw: string): { url: URL; query: [string, string][] } | null {
  try {
    const url = new URL(raw)
    const query: [string, string][] = []
    url.searchParams.forEach((v, k) => query.push([k, v]))
    return { url, query }
  } catch {
    return null
  }
}

function parseCurl(raw: string): ParsedRequest | { error: string } {
  const compact = raw.replace(/\\\n/g, ' ').trim()
  const args = splitArgs(compact)
  if (args[0] && args[0].toLowerCase() !== 'curl') {
    return { error: 'Not a curl command' }
  }
  let method = 'GET'
  let url = ''
  const headers: [string, string][] = []
  let body = ''
  for (let i = 1; i < args.length; i++) {
    const a = args[i]
    const next = () => args[++i] ?? ''
    if (a === '-X' || a === '--request') method = next().toUpperCase()
    else if (a === '-H' || a === '--header') {
      const h = next()
      const idx = h.indexOf(':')
      if (idx >= 0) headers.push([h.slice(0, idx).trim(), h.slice(idx + 1).trim()])
    } else if (
      a === '-d' ||
      a === '--data' ||
      a === '--data-raw' ||
      a === '--data-binary'
    ) {
      body = next()
      if (method === 'GET') method = 'POST'
    } else if (a === '--json') {
      body = next()
      if (method === 'GET') method = 'POST'
      headers.push(['Content-Type', 'application/json'])
    } else if (a === '-u' || a === '--user') {
      headers.push(['Authorization', `Basic ${btoa(next())}`])
    } else if (a === '-G' || a === '--get') {
      method = 'GET'
    } else if (!a.startsWith('-') && !url) {
      url = a
    }
  }
  if (!url) return { error: 'No URL found in curl' }
  const parsed = parseUrl(url)
  if (!parsed) return { error: 'URL is invalid' }
  return {
    method,
    url: parsed.url.toString(),
    headers,
    query: parsed.query,
    body
  }
}

function parseInput(raw: string): ParsedRequest | { error: string } {
  const t = raw.trim()
  if (!t) return { error: '' }
  if (/^\s*curl\b/i.test(t)) return parseCurl(t)
  const parsed = parseUrl(t)
  if (!parsed) return { error: 'Paste a URL or a curl command' }
  return {
    method: 'GET',
    url: parsed.url.toString(),
    headers: [],
    query: parsed.query,
    body: ''
  }
}

function toCurl(req: ParsedRequest): string {
  const u = new URL(req.url)
  u.search = ''
  for (const [k, v] of req.query) u.searchParams.append(k, v)
  const parts = ['curl']
  if (req.method !== 'GET') parts.push('-X', req.method)
  parts.push(`'${u.toString()}'`)
  for (const [k, v] of req.headers) parts.push('-H', `'${k}: ${v}'`)
  if (req.body) parts.push('--data-raw', `'${req.body.replace(/'/g, `'\\''`)}'`)
  return parts.join(' \\\n  ')
}

function toFetch(req: ParsedRequest): string {
  const u = new URL(req.url)
  u.search = ''
  for (const [k, v] of req.query) u.searchParams.append(k, v)
  const headers = Object.fromEntries(req.headers)
  const init: string[] = []
  if (req.method !== 'GET') init.push(`method: '${req.method}'`)
  if (req.headers.length)
    init.push(`headers: ${JSON.stringify(headers, null, 2)}`)
  if (req.body) init.push(`body: ${JSON.stringify(req.body)}`)
  if (!init.length) return `await fetch('${u.toString()}')`
  return `await fetch('${u.toString()}', {\n  ${init.join(',\n  ')}\n})`
}

function KvList({
  rows,
  empty
}: {
  rows: [string, string][]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="px-3 py-2 text-[12px] text-text-muted">{empty}</p>
  }
  return (
    <ul className="divide-y divide-border-subtle">
      {rows.map(([k, v], i) => (
        <li
          key={`${k}-${i}`}
          className="flex gap-3 px-3 py-1.5 font-mono text-[12px]"
        >
          <span className="w-[140px] shrink-0 text-info truncate" title={k}>
            {k}
          </span>
          <span className="min-w-0 flex-1 break-all text-text-primary">{v}</span>
        </li>
      ))}
    </ul>
  )
}

export function UrlCurlInspector() {
  const saved = useTextToolSessionStore.getState().urlCurl
  const patch = useTextToolSessionStore((s) => s.patchUrlCurl)
  const [input, setInput] = useState(saved.input)
  const [outKind, setOutKind] = useState<OutKind>(saved.outKind)
  const [splitPct, setSplitPct] = useState(saved.splitPct ?? 48)
  const [outPct, setOutPct] = useState(saved.outPct ?? 36)
  const [headPct, setHeadPct] = useState(saved.headPct ?? 40)
  const [queryPct, setQueryPct] = useState(saved.queryPct ?? 45)

  useHandoffPayload(setInput)

  useEffect(() => {
    patch({ input, outKind, splitPct, outPct, headPct, queryPct })
  }, [input, outKind, splitPct, outPct, headPct, queryPct, patch])

  const parsed = useMemo(() => parseInput(input), [input])
  const output = useMemo(() => {
    if ('error' in parsed) return ''
    if (outKind === 'curl') return toCurl(parsed)
    if (outKind === 'fetch') return toFetch(parsed)
    const u = new URL(parsed.url)
    u.search = ''
    for (const [k, v] of parsed.query) u.searchParams.append(k, v)
    return u.toString()
  }, [parsed, outKind])

  const ok = parsed && !('error' in parsed)

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <ToolSeg
            options={['url', 'curl', 'fetch'] as const}
            value={outKind}
            onChange={setOutKind}
            labels={{ url: 'URL', curl: 'cURL', fetch: 'fetch' }}
          />
          {'error' in parsed && parsed.error && input.trim() ? (
            <ToolBadge tone="err">Could not parse</ToolBadge>
          ) : ok ? (
            <ToolBadge tone="ok">{parsed.method}</ToolBadge>
          ) : null}
          <ToolPasteCopy
            onPaste={setInput}
            copyText={output}
            copyDisabled={!output}
            toastOnBlock
            toastOnCopy={outKind}
          />
        </ToolToolbar>
      </WorkspaceToolbar>

      <SplitPane
        axis="x"
        value={splitPct}
        onChange={setSplitPct}
        className="flex-1 min-h-0"
      >
        <ToolPane
          className="h-full min-h-0"
          title="Input"
          bodyClassName="p-0 h-full flex flex-col"
        >
          <ToolMonoTextarea
            className="overflow-auto"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a URL or curl command…"
          />
          {'error' in parsed && parsed.error && input.trim() ? (
            <p className="flex-shrink-0 border-t border-danger/25 bg-danger/10 px-4 py-2 text-[12px] text-danger">
              {parsed.error}
            </p>
          ) : null}
        </ToolPane>

        <div className="h-full min-h-0 flex flex-col">
          {ok && (
            <div className="grid grid-cols-3 gap-2 flex-shrink-0 text-[12px] mb-2">
              <div className="rounded-xl border border-border-subtle bg-bg-card px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  Method
                </p>
                <p className="font-mono text-accent mt-0.5">{parsed.method}</p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-bg-card px-3 py-2 min-w-0 col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  Host
                </p>
                <p className="font-mono text-info mt-0.5 truncate">
                  {(() => {
                    try {
                      return new URL(parsed.url).host
                    } catch {
                      return '—'
                    }
                  })()}
                </p>
              </div>
            </div>
          )}

          <SplitPane
            axis="y"
            value={outPct}
            onChange={setOutPct}
            min={18}
            max={80}
            className="flex-1 min-h-0"
          >
            <ToolPane
              title={
                outKind === 'curl'
                  ? 'cURL'
                  : outKind === 'fetch'
                    ? 'fetch'
                    : 'URL'
              }
              className="h-full min-h-0"
              bodyClassName="p-0 h-full overflow-auto"
            >
              {outKind === 'curl' ? (
                <CodePane>{highlightCurl(output)}</CodePane>
              ) : outKind === 'fetch' ? (
                <CodePane>{highlightFetch(output)}</CodePane>
              ) : (
                <CodePane>
                  <span className="text-success">{output}</span>
                </CodePane>
              )}
            </ToolPane>
            {ok ? (
              <SplitPane
                axis="y"
                value={headPct}
                onChange={setHeadPct}
                min={20}
                max={80}
                className="h-full"
              >
                <ToolPane
                  title={`Headers · ${parsed.headers.length}`}
                  className="h-full min-h-0"
                  bodyClassName="p-0 overflow-auto"
                >
                  <KvList rows={parsed.headers} empty="No headers" />
                </ToolPane>
                <SplitPane
                  axis="y"
                  value={queryPct}
                  onChange={setQueryPct}
                  min={20}
                  max={80}
                  className="h-full"
                >
                  <ToolPane
                    title={`Query · ${parsed.query.length}`}
                    className="h-full min-h-0"
                    bodyClassName="p-0 overflow-auto"
                  >
                    <KvList rows={parsed.query} empty="No query string" />
                  </ToolPane>
                  <ToolPane
                    title="Body"
                    className="h-full min-h-0"
                    bodyClassName="p-0 overflow-auto"
                  >
                    {parsed.body ? (
                      <CodePane>{parsed.body}</CodePane>
                    ) : (
                      <p className="px-3 py-2 text-[12px] text-text-muted">
                        No body
                      </p>
                    )}
                  </ToolPane>
                </SplitPane>
              </SplitPane>
            ) : (
              <div className="h-full" />
            )}
          </SplitPane>
        </div>
      </SplitPane>
    </ToolFullscreenShell>
  )
}
