import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { Copy, Eraser, Play, Terminal } from 'lucide-react'
import { clsx } from 'clsx'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { Prec } from '@codemirror/state'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { useSettingsStore } from '../../../stores/settingsStore'
import {
  JS_CONSOLE_DEFAULT_CODE,
  useTextToolSessionStore
} from '../../../stores/textToolSessionStore'
import {
  ToolBadge,
  ToolButton,
  ToolPane,
  ToolToolbar
} from './toolUi'
import {
  portpilotEditorTheme,
  portpilotHighlight
} from './jsEditorTheme'
import { ToolImmersiveButton } from './ToolWorkspaceExtras'

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'result' | 'system'

type LogLine = {
  id: string
  level: LogLevel
  text: string
  /** 1-based source line in the editor, when known */
  line?: number | null
  /** Start of a distinct console entry (shows `>` gutter) */
  entryStart?: boolean
}

function isLogLevel(v: string): v is LogLevel {
  return (
    v === 'log' ||
    v === 'info' ||
    v === 'warn' ||
    v === 'error' ||
    v === 'result' ||
    v === 'system'
  )
}

function reviveLogs(
  logs: {
    id: string
    level: string
    text: string
    line?: number | null
    entryStart?: boolean
  }[]
): LogLine[] {
  return logs.map((l) => ({
    ...l,
    level: isLogLevel(l.level) ? l.level : 'log'
  }))
}

const SANDBOX_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><script>
(function () {
  var SOURCE = 'editor.js';
  function serialize(value) {
    if (value === undefined) return { t: 'undefined' };
    if (value === null) return { t: 'null' };
    if (typeof value === 'string') return { t: 'string', v: value };
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return { t: typeof value, v: String(value) };
    }
    if (typeof value === 'function') {
      return { t: 'function', v: value.name ? '[Function: ' + value.name + ']' : '[Function]' };
    }
    if (typeof value === 'symbol') return { t: 'symbol', v: String(value) };
    try {
      return { t: 'json', v: JSON.stringify(value, getReplacer(), 2) };
    } catch (e) {
      return { t: 'string', v: Object.prototype.toString.call(value) };
    }
  }
  function getReplacer() {
    var seen = new WeakSet();
    return function (_k, v) {
      if (typeof v === 'bigint') return String(v) + 'n';
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    };
  }
  function formatArgs(args) {
    return args.map(function (a) {
      var s = serialize(a);
      if (s.t === 'string') return s.v;
      if (s.t === 'undefined') return 'undefined';
      if (s.t === 'null') return 'null';
      if (s.t === 'json') return s.v;
      return s.v;
    }).join(' ');
  }
  function lineFromStack(stack) {
    if (!stack) return null;
    var re = new RegExp(SOURCE.replace('.', '\\\\.') + ':(\\d+)(?::\\d+)?', 'g');
    var m = re.exec(String(stack));
    if (m) {
      var hit = Number(m[1]);
      if (!Number.isNaN(hit)) return hit;
    }
    // Fallback: anonymous Function body lines (Chromium / Safari)
    var frames = String(stack).split('\\n');
    for (var i = 0; i < frames.length; i++) {
      var anon = frames[i].match(/<anonymous>:(\\d+)(?::\\d+)?/);
      if (anon) {
        var n = Number(anon[1]);
        // AsyncFunction wraps user code starting at line 2 or 3 depending on engine
        if (n >= 2) return Math.max(1, n - 2);
      }
    }
    return null;
  }
  function callerLine() {
    try {
      return lineFromStack(new Error().stack);
    } catch (e) {
      return null;
    }
  }
  function push(logs, level, args, lineOverride) {
    logs.push({
      level: level,
      text: formatArgs(args),
      line: lineOverride != null ? lineOverride : callerLine()
    });
  }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'run') return;
    var logs = [];
    var fakeConsole = {
      log: function () { push(logs, 'log', [].slice.call(arguments)); },
      info: function () { push(logs, 'info', [].slice.call(arguments)); },
      warn: function () { push(logs, 'warn', [].slice.call(arguments)); },
      error: function () { push(logs, 'error', [].slice.call(arguments)); },
      clear: function () { logs = []; }
    };
    var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    var body = String(data.code || '') + '\\n//# sourceURL=' + SOURCE;
    Promise.resolve()
      .then(function () {
        var fn = new AsyncFunction('console', body);
        return fn(fakeConsole);
      })
      .then(function (result) {
        parent.postMessage({ type: 'done', id: data.id, logs: logs, result: serialize(result) }, '*');
      })
      .catch(function (err) {
        var msg = err && err.message ? String(err.message) : String(err);
        var stack = err && err.stack ? String(err.stack) : '';
        var line = lineFromStack(stack);
        logs.push({
          level: 'error',
          text: stack || msg,
          line: line
        });
        parent.postMessage({ type: 'done', id: data.id, logs: logs, error: true }, '*');
      });
  });
  parent.postMessage({ type: 'ready' }, '*');
})();
</script></body></html>`

function formatSerialized(s: {
  t: string
  v?: string
}): string {
  if (s.t === 'undefined') return 'undefined'
  if (s.t === 'null') return 'null'
  return s.v ?? String(s.t)
}

function levelClass(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'text-danger'
    case 'warn':
      return 'text-warning'
    case 'result':
      return 'text-[#7ecfa2]'
    case 'system':
      return 'text-text-muted'
    case 'info':
      return 'text-accent'
    default:
      return 'text-text-primary'
  }
}

export function JsConsole() {
  const darkMode = useSettingsStore((s) => s.darkMode)
  const saved = useTextToolSessionStore.getState().jsConsole
  const patchSession = useTextToolSessionStore((s) => s.patchJsConsole)

  const [code, setCode] = useState(saved.code || JS_CONSOLE_DEFAULT_CODE)
  const [logs, setLogs] = useState<LogLine[]>(() => reviveLogs(saved.logs))
  const [running, setRunning] = useState(false)
  const [lastOk, setLastOk] = useState<boolean | null>(saved.lastOk)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<{
    id: string
    resolve: (v: {
      logs: { level: string; text: string; line?: number | null }[]
      result?: { t: string; v?: string }
      error?: boolean
    }) => void
  } | null>(null)
  const outRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const runId = useRef(0)
  const runRef = useRef<() => void>(() => {})

  useEffect(() => {
    patchSession({ code, logs, lastOk })
  }, [code, logs, lastOk, patchSession])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'ready') {
        readyRef.current = true
        return
      }
      if (data.type === 'done') {
        const pending = pendingRef.current
        if (pending && pending.id === data.id) {
          pending.resolve({
            logs: Array.isArray(data.logs) ? data.logs : [],
            result: data.result,
            error: Boolean(data.error)
          })
          pendingRef.current = null
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight })
  }, [logs])

  const appendLines = useCallback((lines: Omit<LogLine, 'id'>[]) => {
    setLogs((prev) => [
      ...prev,
      ...lines.map((l) => ({
        ...l,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      }))
    ])
  }, [])

  const goToLine = useCallback((line: number) => {
    const view = editorViewRef.current
    if (!view || line < 1) return
    const max = view.state.doc.lines
    const ln = Math.min(line, max)
    const pos = view.state.doc.line(ln).from
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' })
    })
    view.focus()
  }, [])

  const lastExpressionLine = useCallback((src: string): number | null => {
    const lines = src.split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i].trim()
      if (!t || t.startsWith('//')) continue
      return i + 1
    }
    return lines.length || null
  }, [])

  const run = useCallback(async () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || running) return
    const id = `run-${++runId.current}`
    setRunning(true)

    const waitReady = async () => {
      if (readyRef.current) return
      await new Promise<void>((resolve) => {
        const start = Date.now()
        const tick = () => {
          if (readyRef.current || Date.now() - start > 2000) resolve()
          else requestAnimationFrame(tick)
        }
        tick()
      })
    }

    await waitReady()

    const result = await new Promise<{
      logs: { level: string; text: string; line?: number | null }[]
      result?: { t: string; v?: string }
      error?: boolean
    }>((resolve) => {
      const timer = window.setTimeout(() => {
        if (pendingRef.current?.id === id) {
          pendingRef.current = null
          resolve({
            logs: [{ level: 'error', text: 'Timed out after 8s' }],
            error: true
          })
        }
      }, 8000)

      pendingRef.current = {
        id,
        resolve: (v) => {
          window.clearTimeout(timer)
          resolve(v)
        }
      }

      try {
        iframe.contentWindow!.postMessage({ type: 'run', id, code }, '*')
      } catch (e) {
        window.clearTimeout(timer)
        pendingRef.current = null
        resolve({
          logs: [
            {
              level: 'error',
              text: e instanceof Error ? e.message : 'Failed to run'
            }
          ],
          error: true
        })
      }
    })

    const next: Omit<LogLine, 'id'>[] = []
    for (const l of result.logs) {
      const level = (
        ['log', 'info', 'warn', 'error'].includes(l.level) ? l.level : 'log'
      ) as LogLevel
      const srcLine =
        typeof l.line === 'number' && l.line > 0 ? l.line : null
      const parts = String(l.text).split('\n')
      parts.forEach((part, idx) => {
        next.push({
          level,
          text: part,
          line: idx === 0 ? srcLine : null,
          entryStart: idx === 0
        })
      })
    }

    if (!result.error && result.result && result.result.t !== 'undefined') {
      next.push({
        level: 'result',
        text: `← ${formatSerialized(result.result)}`,
        line: lastExpressionLine(code),
        entryStart: true
      })
    }

    if (next.length === 0 && !result.error) {
      next.push({
        level: 'system',
        text: 'undefined',
        line: lastExpressionLine(code),
        entryStart: true
      })
    }

    appendLines(next)
    setLastOk(!result.error)
    setRunning(false)
  }, [appendLines, code, lastExpressionLine, running])

  useEffect(() => {
    runRef.current = () => {
      void run()
    }
  }, [run])

  const extensions = useMemo(
    () => [
      javascript({ jsx: false, typescript: false }),
      portpilotEditorTheme(darkMode),
      portpilotHighlight(darkMode),
      keymap.of([indentWithTab]),
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              runRef.current()
              return true
            }
          },
          {
            key: 'Ctrl-Enter',
            run: () => {
              runRef.current()
              return true
            }
          }
        ])
      )
    ],
    [darkMode]
  )

  const copyCode = () => {
    void navigator.clipboard.writeText(code)
  }

  const copyOutput = () => {
    const text = logs
      .map((l) => (l.entryStart ? `> ${l.text}` : `  ${l.text}`))
      .join('\n')
    void navigator.clipboard.writeText(text)
  }

  const onRootKeyDownCapture = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      void run()
    }
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col gap-2"
      onKeyDownCapture={onRootKeyDownCapture}
    >
      <iframe
        ref={iframeRef}
        title="JS sandbox"
        sandbox="allow-scripts"
        srcDoc={SANDBOX_HTML}
        className="hidden"
      />

      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          {lastOk === true && <ToolBadge tone="ok">OK</ToolBadge>}
          {lastOk === false && <ToolBadge tone="err">Error</ToolBadge>}
          <ToolButton
            variant="ghost"
            disabled={logs.length === 0}
            onClick={copyOutput}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy output
          </ToolButton>

          <span className="ml-auto flex items-center gap-1.5">
            <ToolButton
              variant="danger"
              disabled={logs.length === 0}
              onClick={() => {
                setLogs([])
                setLastOk(null)
              }}
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear console
            </ToolButton>
            <ToolButton
              variant="primary"
              disabled={running}
              onClick={() => void run()}
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'Running…' : 'Run'}
              <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium opacity-80">
                <span className="kbd !bg-white/15 !border-white/20 !text-white/90">
                  ⌘
                </span>
                <span className="kbd !bg-white/15 !border-white/20 !text-white/90">
                  ↵
                </span>
              </span>
            </ToolButton>
          </span>
        </ToolToolbar>
      </WorkspaceToolbar>

      <div className="flex-shrink-0 flex items-center min-h-[28px]">
        <ToolImmersiveButton className="ml-auto" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2">
        <div className="min-h-0 flex-1 flex flex-col lg:w-1/2">
          <ToolPane
            className="h-full min-h-0"
            title="Editor"
            actions={
              <span className="text-[11px] text-text-muted">JavaScript</span>
            }
            bodyClassName="p-0 h-full flex flex-col overflow-hidden relative"
          >
            <button
              type="button"
              title="Copy code"
              onClick={copyCode}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-bg-elevated/90 border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-hover shadow-sm backdrop-blur-sm"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <CodeMirror
              value={code}
              height="100%"
              theme="none"
              extensions={extensions}
              onChange={setCode}
              onCreateEditor={(view) => {
                editorViewRef.current = view
              }}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                highlightSelectionMatches: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: false,
                indentOnInput: true,
                syntaxHighlighting: false,
                history: true,
                defaultKeymap: true,
                searchKeymap: true,
                historyKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: false
              }}
              className="h-full min-h-0 [&_.cm-editor]:h-full [&_.cm-editor]:outline-none"
            />
          </ToolPane>
        </div>

        <div className="min-h-0 flex-1 flex flex-col lg:w-1/2">
          <ToolPane
            className="h-full min-h-0"
            title="Console"
            actions={
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                <Terminal className="w-3 h-3" />
                {logs.length} line{logs.length === 1 ? '' : 's'}
              </span>
            }
            bodyClassName="p-0 h-full flex flex-col"
          >
            <div
              ref={outRef}
              className="flex-1 min-h-0 overflow-auto pl-0 pr-2 py-2 font-mono text-[12.5px] leading-5"
            >
              {logs.length === 0 ? (
                <p className="text-text-muted text-[13px] px-3 py-1">
                  Output appears here — each entry starts with{' '}
                  <code className="text-text-secondary">&gt;</code>. Click a
                  row to jump to its editor line when available.
                </p>
              ) : (
                logs.map((entry, i) => {
                  const prev = logs[i - 1]
                  const newBlock =
                    entry.entryStart &&
                    i > 0 &&
                    (prev?.entryStart || prev?.level !== entry.level)
                  return (
                    <div
                      key={entry.id}
                      className={clsx(
                        'flex gap-2 items-start rounded-sm pr-1 py-0.5',
                        entry.entryStart && i > 0 && 'mt-1.5',
                        newBlock && 'border-t border-border-subtle/80 pt-1.5',
                        entry.line != null &&
                          'hover:bg-bg-hover/50 cursor-pointer'
                      )}
                      onClick={
                        entry.line != null
                          ? () => goToLine(entry.line!)
                          : undefined
                      }
                      title={
                        entry.line != null
                          ? `Go to line ${entry.line}`
                          : undefined
                      }
                    >
                      <span
                        className={clsx(
                          'w-6 flex-shrink-0 text-center select-none leading-5 text-text-muted',
                          !entry.entryStart && 'opacity-0'
                        )}
                        aria-hidden={!entry.entryStart}
                      >
                        &gt;
                      </span>
                      <pre
                        className={clsx(
                          'flex-1 min-w-0 m-0 whitespace-pre-wrap break-words leading-5',
                          levelClass(entry.level)
                        )}
                      >
                        {entry.text || ' '}
                      </pre>
                      {entry.line != null && (
                        <span className="w-8 flex-shrink-0 text-right tabular-nums text-[11px] leading-5 text-text-muted">
                          {entry.line}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ToolPane>
        </div>
      </div>
    </div>
  )
}
