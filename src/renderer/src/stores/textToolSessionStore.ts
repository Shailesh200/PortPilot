import { create } from 'zustand'
import type { Fmt } from '../modules/text/tools/formatConvertCore'

export type JsonFormatterSession = {
  input: string
  indent: '2' | '4' | '0'
  mode: 'tree' | 'raw'
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

export type JsConsoleSession = {
  code: string
  logs: {
    id: string
    level: string
    text: string
    line?: number | null
    entryStart?: boolean
  }[]
  lastOk: boolean | null
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

export const JS_CONSOLE_DEFAULT_CODE = `// Sandboxed JS runtime — last expression shows as ← result
2 + 2
`

const defaultJsonFormatter = (): JsonFormatterSession => ({
  input: '',
  indent: '2',
  mode: 'tree',
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

const defaultJsConsole = (): JsConsoleSession => ({
  code: JS_CONSOLE_DEFAULT_CODE,
  logs: [],
  lastOk: null
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

interface TextToolSessionState {
  jsonFormatter: JsonFormatterSession
  jsonDiff: JsonDiffSession
  jsConsole: JsConsoleSession
  textDiff: TextDiffSession
  formatConverter: FormatConverterSession
  clipboardUi: ClipboardUiSession

  patchJsonFormatter: (patch: Partial<JsonFormatterSession>) => void
  patchJsonDiff: (patch: Partial<JsonDiffSession>) => void
  patchJsConsole: (patch: Partial<JsConsoleSession>) => void
  patchTextDiff: (patch: Partial<TextDiffSession>) => void
  patchFormatConverter: (patch: Partial<FormatConverterSession>) => void
  patchClipboardUi: (patch: Partial<ClipboardUiSession>) => void

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

  resetJsonFormatter: () => set({ jsonFormatter: defaultJsonFormatter() }),
  resetJsonDiff: () => set({ jsonDiff: defaultJsonDiff() }),
  resetJsConsole: () => set({ jsConsole: defaultJsConsole() }),
  resetTextDiff: () => set({ textDiff: defaultTextDiff() }),
  resetFormatConverter: () =>
    set({ formatConverter: defaultFormatConverter() })
}))
