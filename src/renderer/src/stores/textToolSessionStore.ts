import { create } from 'zustand'
import type { Fmt } from '../modules/text/tools/formatConvertCore'
import type { EncodeKind } from '../modules/text/tools/encodeDecodeCore'

export type JsonFormatterSession = {
  input: string
  indent: '2' | '4' | '0'
  mode: 'tree' | 'raw'
  kind: 'json' | 'html' | 'css' | 'js' | 'log'
  sortKeys: boolean
  leftPct: number
}

export type JsonDiffSession = {
  leftRaw: string
  rightRaw: string
  ignoreKeyOrder: boolean
  mode: 'semantic' | 'line'
  showSources: boolean
  leftPct: number
  sourcesPct: number
}

export type JsPlaygroundLayout = 'classic' | 'columns' | 'bottom' | 'tabs'

export type JsConsoleSession = {
  html: string
  css: string
  code: string
  resources: string
  layout: JsPlaygroundLayout
  logs: {
    id: string
    level: string
    text: string
    line?: number | null
    entryStart?: boolean
  }[]
  lastOk: boolean | null
  colPct: number
  rowPct: number
  resultPct: number
  topColPct: number
  botColPct: number
}

export type TextDiffSession = {
  left: string
  right: string
  split: boolean
}

export type FormatConverterSession = {
  from: Fmt
  to: Fmt
  input: string
  importName: string | null
  previewInput: boolean
  previewOutput: boolean
}

export type ClipboardUiSession = {
  query: string
  selectedId: string | null
}

export type EncodeDecodeSession = {
  input: string
  kind: EncodeKind
  mode: 'encode' | 'decode'
}

export type JwtInspectorSession = {
  token: string
  secret: string
  secretBase64: boolean
}

export type UrlCurlSession = {
  input: string
  outKind: 'curl' | 'fetch' | 'url'
  splitPct: number
  outPct: number
  headPct: number
  queryPct: number
}

export type RegexPlaygroundSession = {
  pattern: string
  flags: string
  sample: string
  replace: string
}

export type TimeBenchSession = {
  input: string
}

export const JS_PLAYGROUND_DEFAULT_HTML = `<div class="card">
  <h1>Hello from PortPilot</h1>
  <p>Edit HTML, CSS, and JavaScript — then Run, or turn on Auto-run.</p>
  <button id="go">Log to console</button>
</div>
`

export const JS_PLAYGROUND_DEFAULT_CSS = `:root { color-scheme: dark; }
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
  background: #111318;
  color: #e8eaed;
  padding: 24px;
}
.card { max-width: 28rem; }
h1 { font-size: 1.5rem; color: #8b9cff; }
button {
  margin-top: 12px;
  padding: 8px 14px;
  border: 0;
  border-radius: 8px;
  background: #4f8cff;
  color: white;
  cursor: pointer;
}
`

export const JS_PLAYGROUND_DEFAULT_JS = `document.getElementById('go')?.addEventListener('click', () => {
  console.log('Hello from PortPilot!')
})
`

const defaultJsConsole = (): JsConsoleSession => ({
  html: JS_PLAYGROUND_DEFAULT_HTML,
  css: JS_PLAYGROUND_DEFAULT_CSS,
  code: JS_PLAYGROUND_DEFAULT_JS,
  resources: '',
  layout: 'classic',
  logs: [],
  lastOk: null,
  colPct: 50,
  rowPct: 50,
  resultPct: 72,
  topColPct: 50,
  botColPct: 50
})

const defaultJsonFormatter = (): JsonFormatterSession => ({
  input: '',
  indent: '2',
  mode: 'tree',
  kind: 'json',
  sortKeys: false,
  leftPct: 50
})

const defaultJsonDiff = (): JsonDiffSession => ({
  leftRaw: '',
  rightRaw: '',
  ignoreKeyOrder: true,
  mode: 'semantic',
  showSources: true,
  leftPct: 50,
  sourcesPct: 32
})

const defaultTextDiff = (): TextDiffSession => ({
  left: '',
  right: '',
  split: true
})

const defaultFormatConverter = (): FormatConverterSession => ({
  from: 'yaml',
  to: 'json',
  input: '',
  importName: null,
  previewInput: false,
  previewOutput: false
})

const defaultClipboardUi = (): ClipboardUiSession => ({
  query: '',
  selectedId: null
})

const HELLO = 'Hello from PortPilot!'
const HELLO_B64 = 'SGVsbG8gZnJvbSBQb3J0UGlsb3Qh'

const defaultEncodeDecode = (): EncodeDecodeSession => ({
  input: HELLO_B64,
  kind: 'base64',
  mode: 'decode'
})

const defaultJwtInspector = (): JwtInspectorSession => ({
  token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwb3J0cGlsb3QiLCJuYW1lIjoiSGVsbG8gZnJvbSBQb3J0UGlsb3QhIiwiaWF0IjoxNTE2MjM5MDIyfQ.47KnRlcwkNS5M9fnU6yTAw7W8bIg_m3rF0GoDaXSOEI',
  secret: 'portpilot',
  secretBase64: false
})

const defaultUrlCurl = (): UrlCurlSession => ({
  input: '',
  outKind: 'curl',
  splitPct: 48,
  outPct: 36,
  headPct: 40,
  queryPct: 45
})

const defaultRegexPlayground = (): RegexPlaygroundSession => ({
  pattern: '',
  flags: 'gm',
  sample: '',
  replace: ''
})

const defaultTimeBench = (): TimeBenchSession => ({
  input: ''
})

interface TextToolSessionState {
  jsonFormatter: JsonFormatterSession
  jsonDiff: JsonDiffSession
  jsConsole: JsConsoleSession
  textDiff: TextDiffSession
  formatConverter: FormatConverterSession
  clipboardUi: ClipboardUiSession
  encodeDecode: EncodeDecodeSession
  jwtInspector: JwtInspectorSession
  urlCurl: UrlCurlSession
  regexPlayground: RegexPlaygroundSession
  timeBench: TimeBenchSession

  patchJsonFormatter: (patch: Partial<JsonFormatterSession>) => void
  patchJsonDiff: (patch: Partial<JsonDiffSession>) => void
  patchJsConsole: (patch: Partial<JsConsoleSession>) => void
  patchTextDiff: (patch: Partial<TextDiffSession>) => void
  patchFormatConverter: (patch: Partial<FormatConverterSession>) => void
  patchClipboardUi: (patch: Partial<ClipboardUiSession>) => void
  patchEncodeDecode: (patch: Partial<EncodeDecodeSession>) => void
  patchJwtInspector: (patch: Partial<JwtInspectorSession>) => void
  patchUrlCurl: (patch: Partial<UrlCurlSession>) => void
  patchRegexPlayground: (patch: Partial<RegexPlaygroundSession>) => void
  patchTimeBench: (patch: Partial<TimeBenchSession>) => void

  resetJsonFormatter: () => void
  resetJsonDiff: () => void
  resetJsConsole: () => void
  resetTextDiff: () => void
  resetFormatConverter: () => void
}

export const useTextToolSessionStore = create<TextToolSessionState>((set) => ({
  jsonFormatter: defaultJsonFormatter(),
  jsonDiff: defaultJsonDiff(),
  jsConsole: defaultJsConsole(),
  textDiff: defaultTextDiff(),
  formatConverter: defaultFormatConverter(),
  clipboardUi: defaultClipboardUi(),
  encodeDecode: defaultEncodeDecode(),
  jwtInspector: defaultJwtInspector(),
  urlCurl: defaultUrlCurl(),
  regexPlayground: defaultRegexPlayground(),
  timeBench: defaultTimeBench(),

  patchJsonFormatter: (patch) =>
    set((s) => ({ jsonFormatter: { ...s.jsonFormatter, ...patch } })),
  patchJsonDiff: (patch) =>
    set((s) => ({ jsonDiff: { ...s.jsonDiff, ...patch } })),
  patchJsConsole: (patch) =>
    set((s) => ({ jsConsole: { ...s.jsConsole, ...patch } })),
  patchTextDiff: (patch) =>
    set((s) => ({ textDiff: { ...s.textDiff, ...patch } })),
  patchFormatConverter: (patch) =>
    set((s) => ({ formatConverter: { ...s.formatConverter, ...patch } })),
  patchClipboardUi: (patch) =>
    set((s) => ({ clipboardUi: { ...s.clipboardUi, ...patch } })),
  patchEncodeDecode: (patch) =>
    set((s) => ({ encodeDecode: { ...s.encodeDecode, ...patch } })),
  patchJwtInspector: (patch) =>
    set((s) => ({ jwtInspector: { ...s.jwtInspector, ...patch } })),
  patchUrlCurl: (patch) =>
    set((s) => ({ urlCurl: { ...s.urlCurl, ...patch } })),
  patchRegexPlayground: (patch) =>
    set((s) => ({ regexPlayground: { ...s.regexPlayground, ...patch } })),
  patchTimeBench: (patch) =>
    set((s) => ({ timeBench: { ...s.timeBench, ...patch } })),

  resetJsonFormatter: () => set({ jsonFormatter: defaultJsonFormatter() }),
  resetJsonDiff: () => set({ jsonDiff: defaultJsonDiff() }),
  resetJsConsole: () => set({ jsConsole: defaultJsConsole() }),
  resetTextDiff: () => set({ textDiff: defaultTextDiff() }),
  resetFormatConverter: () =>
    set({ formatConverter: defaultFormatConverter() })
}))
