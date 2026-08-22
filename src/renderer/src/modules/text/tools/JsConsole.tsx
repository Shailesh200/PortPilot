import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react'
import { Columns2, Copy, Eraser, LayoutGrid, Play, Rows3, SquareSplitVertical, Terminal } from 'lucide-react'
import { clsx } from 'clsx'
import type { Extension } from '@codemirror/state'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { useSettingsStore } from '../../../stores/settingsStore'
import {
  JS_PLAYGROUND_DEFAULT_CSS,
  JS_PLAYGROUND_DEFAULT_HTML,
  JS_PLAYGROUND_DEFAULT_JS,
  type JsPlaygroundLayout,
  useTextToolSessionStore
} from '../../../stores/textToolSessionStore'
import {
  ToolBadge,
  ToolButton,
  ToolPane,
  ToolToggle,
  ToolToolbar
} from './toolUi'
import {
  portpilotEditorTheme,
  portpilotHighlight
} from './jsEditorTheme'
import { ToolImmersiveButton } from './ToolWorkspaceExtras'
import { prettyCss, prettyHtml, prettyJs } from '../../../lib/prettyPrint'
import { FillCodeMirror, useLazyCodeMirror } from '../../../lib/lazyCodeMirror'
import { SplitPane } from '../../../shell/SplitPane'

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'result' | 'system'

type LogLine = {
  id: string
  level: LogLevel
  text: string
  line?: number | null
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

const CONSOLE_HOOK = `<script>
(function () {
  function serialize(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'function') {
      return value.name ? '[Function: ' + value.name + ']' : '[Function]';
    }
    try {
      return JSON.stringify(value, function (_k, v) {
        if (typeof v === 'bigint') return String(v) + 'n';
        return v;
      }, 2);
    } catch (e) {
      return String(value);
    }
  }
  function send(level, args) {
    var text = Array.prototype.map.call(args, serialize).join(' ');
    parent.postMessage({ source: 'portpilot-playground', type: 'console', level: level, text: text }, '*');
  }
  var methods = ['log', 'info', 'warn', 'error'];
  methods.forEach(function (m) {
    var orig = console[m] && console[m].bind(console);
    console[m] = function () {
      send(m, arguments);
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) {
    send('error', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]);
  });
  window.addEventListener('unhandledrejection', function (e) {
    send('error', [String(e.reason)]);
  });
  parent.postMessage({ source: 'portpilot-playground', type: 'ready' }, '*');
})();
</script>`

function resourceTags(resources: string): string {
  return resources
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((url) => {
      if (/\.css(\?|$)/i.test(url) || url.includes('fonts.googleapis')) {
        return `<link rel="stylesheet" href="${url.replace(/"/g, '')}" />`
      }
      return `<script src="${url.replace(/"/g, '')}"></script>`
    })
    .join('\n')
}

function buildSrcDoc(html: string, css: string, js: string, resources: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
${CONSOLE_HOOK}
${resourceTags(resources)}
<style>${css}</style>
</head>
<body>
${html}
<script>
try {
${js}
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
}
</script>
</body>
</html>`
}

type CmBundle = {
  CodeMirror: typeof import('@uiw/react-codemirror').default
  javascript: typeof import('@codemirror/lang-javascript').javascript
  htmlLang: typeof import('@codemirror/lang-html').html
  StreamLanguage: typeof import('@codemirror/language').StreamLanguage
  cssMode: typeof import('@codemirror/legacy-modes/mode/css').css
  keymap: typeof import('@codemirror/view').keymap
  indentWithTab: typeof import('@codemirror/commands').indentWithTab
  Prec: typeof import('@codemirror/state').Prec
}

async function loadJsConsoleCm(): Promise<CmBundle> {
  const [cmMod, jsMod, htmlMod, langMod, cssMod, viewMod, cmdMod, stateMod] =
    await Promise.all([
      import('@uiw/react-codemirror'),
      import('@codemirror/lang-javascript'),
      import('@codemirror/lang-html'),
      import('@codemirror/language'),
      import('@codemirror/legacy-modes/mode/css'),
      import('@codemirror/view'),
      import('@codemirror/commands'),
      import('@codemirror/state')
    ])
  return {
    CodeMirror: cmMod.default,
    javascript: jsMod.javascript,
    htmlLang: htmlMod.html,
    StreamLanguage: langMod.StreamLanguage,
    cssMode: cssMod.css,
    keymap: viewMod.keymap,
    indentWithTab: cmdMod.indentWithTab,
    Prec: stateMod.Prec
  }
}

const JS_CM_SETUP = {
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
} as const

const LAYOUTS: {
  id: JsPlaygroundLayout
  label: string
  icon: typeof LayoutGrid
}[] = [
  { id: 'classic', label: 'Grid', icon: LayoutGrid },
  { id: 'columns', label: 'Columns', icon: Columns2 },
  { id: 'bottom', label: 'Result below', icon: SquareSplitVertical },
  { id: 'tabs', label: 'Tabs', icon: Rows3 }
]

export function JsConsole() {
  const darkMode = useSettingsStore((s) => s.darkMode)
  const autoRunSetting = useSettingsStore((s) => s.jsPlaygroundAutoRun)
  const saved = useTextToolSessionStore.getState().jsConsole
  const patchSession = useTextToolSessionStore((s) => s.patchJsConsole)

  const [html, setHtml] = useState(saved.html ?? JS_PLAYGROUND_DEFAULT_HTML)
  const [css, setCss] = useState(saved.css ?? JS_PLAYGROUND_DEFAULT_CSS)
  const [code, setCode] = useState(saved.code || JS_PLAYGROUND_DEFAULT_JS)
  const [resources, setResources] = useState(saved.resources ?? '')
  const [layout, setLayout] = useState<JsPlaygroundLayout>(
    saved.layout ?? 'classic'
  )
  const [tab, setTab] = useState<'html' | 'css' | 'js'>('html')
  const [logs, setLogs] = useState<LogLine[]>(() => reviveLogs(saved.logs ?? []))
  const [lastOk, setLastOk] = useState<boolean | null>(saved.lastOk)
  const [autoRun, setAutoRun] = useState(autoRunSetting)
  const [showResources, setShowResources] = useState(false)
  const [srcDoc, setSrcDoc] = useState('')
  const [runKey, setRunKey] = useState(0)
  const [colPct, setColPct] = useState(saved.colPct ?? 50)
  const [rowPct, setRowPct] = useState(saved.rowPct ?? 50)
  const [resultPct, setResultPct] = useState(saved.resultPct ?? 72)
  const [topColPct, setTopColPct] = useState(saved.topColPct ?? 50)
  const [botColPct, setBotColPct] = useState(saved.botColPct ?? 50)
  const [stackPct, setStackPct] = useState(34)
  const [stackMidPct, setStackMidPct] = useState(50)
  const [thirdPct, setThirdPct] = useState(33)
  const outRef = useRef<HTMLDivElement>(null)
  const runRef = useRef<() => void>(() => {})

  useEffect(() => {
    patchSession({
      html,
      css,
      code,
      resources,
      layout,
      logs,
      lastOk,
      colPct,
      rowPct,
      resultPct,
      topColPct,
      botColPct
    })
  }, [
    html,
    css,
    code,
    resources,
    layout,
    logs,
    lastOk,
    colPct,
    rowPct,
    resultPct,
    topColPct,
    botColPct,
    patchSession
  ])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.source !== 'portpilot-playground') return
      if (data.type === 'console') {
        const level = isLogLevel(data.level) ? data.level : 'log'
        setLogs((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            level,
            text: String(data.text ?? ''),
            entryStart: true
          }
        ])
        if (level === 'error') setLastOk(false)
        else if (lastOk !== false) setLastOk(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [lastOk])

  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight })
  }, [logs])

  const run = useCallback(() => {
    setSrcDoc(buildSrcDoc(html, css, code, resources))
    setRunKey((k) => k + 1)
    setLastOk(true)
  }, [html, css, code, resources])

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => {
    if (!autoRun) return
    const id = window.setTimeout(() => run(), 500)
    return () => window.clearTimeout(id)
  }, [html, css, code, resources, autoRun, run])

  useEffect(() => {
    run()
    // First paint only — later edits go through auto-run / Run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cm = useLazyCodeMirror(loadJsConsoleCm)

  const runKeymap = useMemo((): Extension[] => {
    if (!cm) return []
    return [
      cm.keymap.of([cm.indentWithTab]),
      cm.Prec.highest(
        cm.keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              runRef.current()
              return true
            }
          }
        ])
      )
    ]
  }, [cm])

  const htmlExt = useMemo((): Extension[] => {
    if (!cm) return []
    return [
      cm.htmlLang(),
      portpilotEditorTheme(darkMode),
      portpilotHighlight(darkMode),
      ...runKeymap
    ]
  }, [cm, darkMode, runKeymap])

  const cssExt = useMemo((): Extension[] => {
    if (!cm) return []
    return [
      cm.StreamLanguage.define(cm.cssMode),
      portpilotEditorTheme(darkMode),
      portpilotHighlight(darkMode),
      ...runKeymap
    ]
  }, [cm, darkMode, runKeymap])

  const jsExt = useMemo((): Extension[] => {
    if (!cm) return []
    return [
      cm.javascript({ jsx: false, typescript: false }),
      portpilotEditorTheme(darkMode),
      portpilotHighlight(darkMode),
      ...runKeymap
    ]
  }, [cm, darkMode, runKeymap])

  const copyFiddle = () => {
    void navigator.clipboard.writeText(
      `<!-- HTML -->\n${html}\n<style>\n${css}\n</style>\n<script>\n${code}\n</script>`
    )
  }

  const tidy = () => {
    setHtml(prettyHtml(html, 2))
    setCss(prettyCss(css, 2))
    setCode(prettyJs(code, 2))
  }

  const reset = () => {
    setHtml(JS_PLAYGROUND_DEFAULT_HTML)
    setCss(JS_PLAYGROUND_DEFAULT_CSS)
    setCode(JS_PLAYGROUND_DEFAULT_JS)
    setResources('')
    setLogs([])
    setLastOk(null)
  }

  const onRootKeyDownCapture = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      run()
    }
  }

  const editor = (
    _lang: 'html' | 'css' | 'js',
    value: string,
    onChange: (v: string) => void,
    extensions: Extension[]
  ) => {
    if (!cm) {
      return (
        <p className="p-3 text-[12.5px] text-text-muted">Loading editor…</p>
      )
    }
    return (
      <FillCodeMirror
        CodeMirror={cm.CodeMirror}
        value={value}
        extensions={extensions}
        onChange={onChange}
        basicSetup={JS_CM_SETUP}
      />
    )
  }

  const htmlPane = (
    <ToolPane
      className="h-full min-h-0"
      title="HTML"
      bodyClassName="p-0 h-full flex flex-col overflow-hidden"
    >
      {editor('html', html, setHtml, htmlExt)}
    </ToolPane>
  )
  const cssPane = (
    <ToolPane
      className="h-full min-h-0"
      title="CSS"
      bodyClassName="p-0 h-full flex flex-col overflow-hidden"
    >
      {editor('css', css, setCss, cssExt)}
    </ToolPane>
  )
  const jsPane = (
    <ToolPane
      className="h-full min-h-0"
      title="JavaScript"
      bodyClassName="p-0 h-full flex flex-col overflow-hidden"
    >
      {editor('js', code, setCode, jsExt)}
    </ToolPane>
  )

  const resultPane = (
    <ToolPane
      className="h-full min-h-0"
      title="Result"
      bodyClassName="p-0 h-full overflow-hidden bg-white"
    >
      <iframe
        key={runKey}
        title="JS Sandbox preview"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="h-full w-full border-0 bg-white"
      />
    </ToolPane>
  )

  const consolePane = (
    <ToolPane
      className="h-full min-h-0"
      title="Console"
      actions={
        <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
          <Terminal className="w-3 h-3" />
          {logs.length}
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
            console.log from the preview appears here.
          </p>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-2 items-start rounded-sm pr-1 py-0.5"
            >
              <span className="w-6 flex-shrink-0 text-center select-none leading-5 text-text-muted">
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
            </div>
          ))
        )}
      </div>
    </ToolPane>
  )

  const resultStack = (
    <SplitPane
      axis="y"
      value={resultPct}
      onChange={setResultPct}
      min={22}
      max={90}
      className="h-full"
    >
      {resultPane}
      {consolePane}
    </SplitPane>
  )

  let workspace: ReactNode
  if (layout === 'tabs') {
    workspace = (
      <SplitPane
        axis="x"
        value={colPct}
        onChange={setColPct}
        className="h-full"
      >
        <div className="h-full min-h-0 flex flex-col">
          <div className="flex gap-1 mb-1 flex-shrink-0">
            {(['html', 'css', 'js'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={clsx(
                  'px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider',
                  tab === t
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:bg-bg-elevated'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0">
            {tab === 'html' ? htmlPane : tab === 'css' ? cssPane : jsPane}
          </div>
        </div>
        {resultStack}
      </SplitPane>
    )
  } else if (layout === 'columns') {
    workspace = (
      <SplitPane
        axis="x"
        value={colPct}
        onChange={setColPct}
        className="h-full"
      >
        <SplitPane axis="y" value={stackPct} onChange={setStackPct} min={16} max={70} className="h-full">
          {htmlPane}
          <SplitPane
            axis="y"
            value={stackMidPct}
            onChange={setStackMidPct}
            min={20}
            max={80}
            className="h-full"
          >
            {cssPane}
            {jsPane}
          </SplitPane>
        </SplitPane>
        {resultStack}
      </SplitPane>
    )
  } else if (layout === 'bottom') {
    workspace = (
      <SplitPane
        axis="y"
        value={rowPct}
        onChange={setRowPct}
        className="h-full"
      >
        <SplitPane
          axis="x"
          value={thirdPct}
          onChange={setThirdPct}
          min={18}
          max={50}
          className="h-full"
        >
          {htmlPane}
          <SplitPane axis="x" value={colPct} onChange={setColPct} className="h-full">
            {cssPane}
            {jsPane}
          </SplitPane>
        </SplitPane>
        {resultStack}
      </SplitPane>
    )
  } else {
    workspace = (
      <SplitPane
        axis="y"
        value={rowPct}
        onChange={setRowPct}
        className="h-full"
      >
        <SplitPane axis="x" value={topColPct} onChange={setTopColPct} className="h-full">
          {htmlPane}
          {cssPane}
        </SplitPane>
        <SplitPane axis="x" value={botColPct} onChange={setBotColPct} className="h-full">
          {jsPane}
          {resultStack}
        </SplitPane>
      </SplitPane>
    )
  }

  return (
    <div
      className="h-full min-h-0 flex flex-col gap-2"
      onKeyDownCapture={onRootKeyDownCapture}
    >
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          {lastOk === true && <ToolBadge tone="ok">OK</ToolBadge>}
          {lastOk === false && <ToolBadge tone="err">Error</ToolBadge>}
          <div className="flex items-center gap-0.5 rounded-lg border border-border-subtle p-0.5">
            {LAYOUTS.map((l) => {
              const Icon = l.icon
              return (
                <button
                  key={l.id}
                  type="button"
                  title={l.label}
                  onClick={() => setLayout(l.id)}
                  className={clsx(
                    'p-1.5 rounded-md',
                    layout === l.id
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-muted hover:text-text-primary'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              )
            })}
          </div>
          <ToolToggle label="Auto-run" checked={autoRun} onChange={setAutoRun} />
          <ToolButton
            variant="ghost"
            onClick={() => setShowResources((v) => !v)}
          >
            Resources
          </ToolButton>
          <ToolButton variant="ghost" onClick={tidy}>
            Tidy
          </ToolButton>
          <ToolButton variant="ghost" onClick={copyFiddle}>
            <Copy className="w-3.5 h-3.5" />
            Copy
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
              Clear
            </ToolButton>
            <ToolButton variant="ghost" onClick={reset}>
              Reset
            </ToolButton>
            <ToolButton variant="primary" onClick={run}>
              <Play className="w-3.5 h-3.5" />
              Run
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

      {showResources && (
        <textarea
          value={resources}
          onChange={(e) => setResources(e.target.value)}
          placeholder="One CDN URL per line (css → link, otherwise script)"
          spellCheck={false}
          className="h-16 resize-none rounded-lg border border-border-subtle bg-bg-card px-3 py-2 font-mono text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      )}

      <div className="flex-shrink-0 flex items-center min-h-[28px]">
        <ToolImmersiveButton className="ml-auto" />
      </div>

      <div className="flex-1 min-h-0">{workspace}</div>
    </div>
  )
}
