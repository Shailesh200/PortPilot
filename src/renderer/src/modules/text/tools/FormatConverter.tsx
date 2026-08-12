import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent
} from 'react'
import {
  ArrowLeftRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp
} from 'lucide-react'
import type { Extension } from '@codemirror/state'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useUIStore } from '../../../stores/uiStore'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import {
  ToolButton,
  ToolDivider,
  ToolPane,
  ToolSeg,
  ToolToolbar
} from './toolUi'
import { ToolFullscreenShell, ToolImmersiveButton } from './ToolWorkspaceExtras'
import {
  portpilotEditorTheme,
  portpilotHighlight
} from './jsEditorTheme'
import {
  CONVERSIONS,
  FORMATS,
  FORMAT_EXT,
  FORMAT_LABELS,
  type Fmt,
  base64ToBytes,
  buildBinary,
  bytesToBase64,
  contentToPrintableHtml,
  editorLanguageFmt,
  guessFmt,
  importOfficeFile,
  isBinaryFmt,
  isLegacyDoc,
  parse,
  pickValidTo,
  stringify,
  targetsFor
} from './formatConvertCore'
import { FormatPreview } from './FormatPreview'
import { PdfPagePreview } from './PdfPagePreview'
import { DocxPagePreview } from './DocxPagePreview'
import { PreviewViewport } from './PreviewViewport'

const FILE_ACCEPT =
  '.json,.yaml,.yml,.toml,.xml,.csv,.tsv,.md,.markdown,.txt,.html,.htm,.pdf,.doc,.docx,.xls,.xlsx,application/json,text/csv,text/yaml,text/xml,text/markdown,text/plain,text/html,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

/** Fill parent and let CodeMirror's scroller own overflow. */
const CM_FILL =
  'absolute inset-0 min-h-0 overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor]:max-h-full [&_.cm-scroller]:overflow-auto'

type CmBundle = {
  CodeMirror: typeof import('@uiw/react-codemirror').default
  html: typeof import('@codemirror/lang-html').html
  json: typeof import('@codemirror/lang-json').json
  yamlLang: typeof import('@codemirror/lang-yaml').yaml
  xml: typeof import('@codemirror/lang-xml').xml
  markdown: typeof import('@codemirror/lang-markdown').markdown
  StreamLanguage: typeof import('@codemirror/language').StreamLanguage
  toml: typeof import('@codemirror/legacy-modes/mode/toml').toml
  EditorState: typeof import('@codemirror/state').EditorState
  EditorView: typeof import('@codemirror/view').EditorView
  cmPlaceholder: typeof import('@codemirror/view').placeholder
}

function useCodeMirrorBundle() {
  const [cm, setCm] = useState<CmBundle | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [
        cmMod,
        htmlMod,
        jsonMod,
        yamlMod,
        xmlMod,
        mdMod,
        langMod,
        tomlMod,
        stateMod,
        viewMod
      ] = await Promise.all([
        import('@uiw/react-codemirror'),
        import('@codemirror/lang-html'),
        import('@codemirror/lang-json'),
        import('@codemirror/lang-yaml'),
        import('@codemirror/lang-xml'),
        import('@codemirror/lang-markdown'),
        import('@codemirror/language'),
        import('@codemirror/legacy-modes/mode/toml'),
        import('@codemirror/state'),
        import('@codemirror/view')
      ])
      if (cancelled) return
      setCm({
        CodeMirror: cmMod.default,
        html: htmlMod.html,
        json: jsonMod.json,
        yamlLang: yamlMod.yaml,
        xml: xmlMod.xml,
        markdown: mdMod.markdown,
        StreamLanguage: langMod.StreamLanguage,
        toml: tomlMod.toml,
        EditorState: stateMod.EditorState,
        EditorView: viewMod.EditorView,
        cmPlaceholder: viewMod.placeholder
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return cm
}

/**
 * CodeMirror only scrolls when it has a real pixel height. Percentage heights
 * often collapse in nested flex panes, so we measure the host with ResizeObserver.
 */
function FillCodeMirror({
  value,
  extensions,
  onChange,
  editable = true,
  CodeMirror
}: {
  value: string
  extensions: Extension[]
  onChange?: (v: string) => void
  editable?: boolean
  CodeMirror: CmBundle['CodeMirror']
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [heightPx, setHeightPx] = useState(0)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const apply = () => {
      const next = Math.max(0, Math.floor(el.getBoundingClientRect().height))
      setHeightPx((prev) => (prev === next ? prev : next))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden">
      {heightPx > 0 && (
        <CodeMirror
          value={value}
          height={`${heightPx}px`}
          maxHeight={`${heightPx}px`}
          theme="none"
          basicSetup={{
            foldGutter: true,
            highlightActiveLine: editable,
            highlightSelectionMatches: false
          }}
          extensions={extensions}
          editable={editable}
          onChange={onChange}
          style={{
            height: heightPx,
            maxHeight: heightPx,
            overflow: 'hidden'
          }}
          className="[&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:!overflow-auto"
        />
      )}
    </div>
  )
}

function downloadBasename(importName: string | null, to: Fmt): string {
  if (importName) {
    const base = importName.replace(/\.[^.]+$/, '') || 'converted'
    return `${base}.${FORMAT_EXT[to]}`
  }
  return `converted.${FORMAT_EXT[to]}`
}

function saveFiltersFor(to: Fmt): { name: string; extensions: string[] }[] {
  const ext = FORMAT_EXT[to]
  const extras =
    to === 'xlsx'
      ? [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
      : to === 'docx'
        ? [{ name: 'Word', extensions: ['docx'] }]
        : to === 'pdf'
          ? [{ name: 'PDF', extensions: ['pdf'] }]
          : []
  return [
    { name: FORMAT_LABELS[to], extensions: [ext] },
    ...extras,
    { name: 'All Files', extensions: ['*'] }
  ]
}

function languageExtension(cm: CmBundle, fmt: Fmt): Extension | null {
  switch (editorLanguageFmt(fmt)) {
    case 'json':
      return cm.json()
    case 'yaml':
      return cm.yamlLang()
    case 'toml':
      return cm.StreamLanguage.define(cm.toml)
    case 'xml':
      return cm.xml()
    case 'html':
      return cm.html()
    case 'md':
      return cm.markdown()
    default:
      return null
  }
}

function formatEditorExtensions(
  cm: CmBundle,
  fmt: Fmt,
  dark: boolean,
  opts: { readOnly?: boolean; placeholder?: string }
): Extension[] {
  const lang = languageExtension(cm, fmt)
  return [
    portpilotEditorTheme(dark),
    portpilotHighlight(dark),
    cm.EditorView.lineWrapping,
    ...(lang ? [lang] : []),
    ...(opts.placeholder ? [cm.cmPlaceholder(opts.placeholder)] : []),
    ...(opts.readOnly
      ? [
          cm.EditorState.readOnly.of(true),
          cm.EditorView.editable.of(false)
        ]
      : [])
  ]
}

function PreviewToggle({
  active,
  onToggle
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      title={active ? 'Show source' : 'Show preview'}
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11.5px] text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
    >
      {active ? (
        <EyeOff className="w-3.5 h-3.5" />
      ) : (
        <Eye className="w-3.5 h-3.5" />
      )}
      {active ? 'Source' : 'Preview'}
    </button>
  )
}

export function FormatConverter() {
  const addToast = useUIStore((s) => s.addToast)
  const darkMode = useSettingsStore((s) => s.darkMode)
  const saved = useTextToolSessionStore.getState().formatConverter
  const patchSession = useTextToolSessionStore((s) => s.patchFormatConverter)
  const [from, setFrom] = useState<Fmt>(saved.from)
  const [to, setTo] = useState<Fmt>(saved.to)
  const [input, setInput] = useState(saved.input)
  const [dragOver, setDragOver] = useState(false)
  const [importName, setImportName] = useState<string | null>(saved.importName)
  const [inputPdfBytes, setInputPdfBytes] = useState<Uint8Array | null>(null)
  const [inputDocxBytes, setInputDocxBytes] = useState<Uint8Array | null>(null)
  const [previewInput, setPreviewInput] = useState(saved.previewInput)
  const [previewOutput, setPreviewOutput] = useState(saved.previewOutput)
  const [saving, setSaving] = useState(false)
  const [outputPdfBytes, setOutputPdfBytes] = useState<Uint8Array | null>(null)
  const [outputPdfLoading, setOutputPdfLoading] = useState(false)
  const [outputPdfError, setOutputPdfError] = useState<string | null>(null)
  const [outputDocxBytes, setOutputDocxBytes] = useState<Uint8Array | null>(
    null
  )
  const [outputDocxLoading, setOutputDocxLoading] = useState(false)
  const [outputDocxError, setOutputDocxError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const outputPdfGenRef = useRef(0)
  const outputDocxGenRef = useRef(0)
  const cm = useCodeMirrorBundle()
  const [toOptions, setToOptions] = useState<Fmt[]>(() => [...CONVERSIONS[from]])
  const [canSwap, setCanSwap] = useState(false)
  const [result, setResult] = useState<
    | { ok: true; text: string; data: unknown }
    | { ok: false; error: string; data: unknown }
  >({ ok: true, text: '', data: null })

  useEffect(() => {
    patchSession({
      from,
      to,
      input,
      importName,
      previewInput,
      previewOutput
    })
  }, [
    from,
    to,
    input,
    importName,
    previewInput,
    previewOutput,
    patchSession
  ])

  const fromOptions = useMemo(
    () => (importName ? ([from] as Fmt[]) : [...FORMATS]),
    [importName, from]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const opts = await targetsFor(from, input)
      if (cancelled) return
      setToOptions(opts)
      setTo((prev) => (opts.includes(prev) ? prev : (opts[0] ?? 'txt')))
    })()
    return () => {
      cancelled = true
    }
  }, [from, input])

  // Prefer visual document preview for binary / document targets
  useEffect(() => {
    if (to === 'pdf' || to === 'docx' || to === 'xlsx' || to === 'html' || to === 'md') {
      setPreviewOutput(true)
    }
  }, [to])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!input.trim()) {
        if (!cancelled) setResult({ ok: true, text: '', data: null })
        return
      }
      try {
        const data = await parse(from, input, importName ?? undefined)
        const textOut = await stringify(to, data)
        if (!cancelled) setResult({ ok: true, text: textOut, data })
      } catch (e) {
        if (!cancelled) {
          setResult({
            ok: false,
            error: e instanceof Error ? e.message : 'Conversion failed',
            data: null
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [from, to, input, importName])

  useEffect(() => {
    let cancelled = false
    if (!result.ok || isBinaryFmt(to)) {
      setCanSwap(false)
      return
    }
    void targetsFor(to, result.text).then((opts) => {
      if (!cancelled) setCanSwap(opts.includes(from))
    })
    return () => {
      cancelled = true
    }
  }, [result, to, from])

  // Live PDF bytes for output preview / download parity
  useEffect(() => {
    if (to !== 'pdf' || !result.ok || !input.trim()) {
      setOutputPdfBytes(null)
      setOutputPdfError(null)
      setOutputPdfLoading(false)
      return
    }

    const gen = ++outputPdfGenRef.current
    setOutputPdfLoading(true)
    setOutputPdfError(null)
    const data = result.data

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const htmlDoc = await contentToPrintableHtml({ from, input, data })
          const r = await window.api.saveHtmlAsPdf({
            html: htmlDoc,
            preview: true
          })
          if (gen !== outputPdfGenRef.current) return
          if (r.ok && 'preview' in r && r.preview) {
            setOutputPdfBytes(base64ToBytes(r.base64))
            setOutputPdfError(null)
          } else if (!r.ok && !('canceled' in r && r.canceled)) {
            setOutputPdfBytes(null)
            setOutputPdfError(
              'error' in r ? r.error : 'Could not create PDF preview'
            )
          } else {
            setOutputPdfBytes(null)
            setOutputPdfError('Could not create PDF preview')
          }
        } catch (e) {
          if (gen !== outputPdfGenRef.current) return
          setOutputPdfBytes(null)
          setOutputPdfError(
            e instanceof Error ? e.message : 'Could not create PDF preview'
          )
        } finally {
          if (gen === outputPdfGenRef.current) setOutputPdfLoading(false)
        }
      })()
    }, 450)

    return () => {
      window.clearTimeout(timer)
    }
  }, [to, from, input, result.ok, result.data])

  // Live DOCX bytes for styled Word preview
  useEffect(() => {
    if (to !== 'docx' || !result.ok || !input.trim()) {
      setOutputDocxBytes(null)
      setOutputDocxError(null)
      setOutputDocxLoading(false)
      return
    }

    const gen = ++outputDocxGenRef.current
    setOutputDocxLoading(true)
    setOutputDocxError(null)
    const data = result.data

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const markdownSource =
            from === 'md' || from === 'docx' || from === 'pdf'
              ? input
              : from === 'html'
                ? await stringify('md', data)
                : undefined
          const bytes = await buildBinary('docx', data, { markdownSource })
          if (gen !== outputDocxGenRef.current) return
          setOutputDocxBytes(bytes)
          setOutputDocxError(null)
        } catch (e) {
          if (gen !== outputDocxGenRef.current) return
          setOutputDocxBytes(null)
          setOutputDocxError(
            e instanceof Error ? e.message : 'Could not create DOCX preview'
          )
        } finally {
          if (gen === outputDocxGenRef.current) setOutputDocxLoading(false)
        }
      })()
    }, 450)

    return () => {
      window.clearTimeout(timer)
    }
  }, [to, from, input, result.ok, result.data])

  const inputExtensions = useMemo(
    () =>
      cm
        ? formatEditorExtensions(cm, from, darkMode, {
            placeholder: `Paste ${FORMAT_LABELS[from]} or drop a file…`
          })
        : [],
    [cm, from, darkMode]
  )

  const outputExtensions = useMemo(
    () =>
      cm
        ? formatEditorExtensions(cm, to, darkMode, {
            readOnly: true,
            placeholder: isBinaryFmt(to)
              ? `${FORMAT_LABELS[to]} — use Preview or Download`
              : 'Output appears here…'
          })
        : [],
    [cm, to, darkMode]
  )

  const clearImportLock = () => {
    setImportName(null)
    setInputPdfBytes(null)
    setInputDocxBytes(null)
  }

  const applyFile = useCallback(
    async (file: File) => {
      try {
        if (isLegacyDoc(file.name)) {
          addToast({
            type: 'error',
            title: 'Unsupported format',
            message:
              'Legacy .doc is not supported. Save as .docx in Word, then import.'
          })
          return
        }

        const guessed = guessFmt(file.name)
        if (guessed === 'docx' || guessed === 'xlsx' || guessed === 'pdf') {
          const imported = await importOfficeFile(file)
          setFrom(imported.fmt)
          setTo(await pickValidTo(imported.fmt, to, imported.text))
          setImportName(file.name)
          setInput(imported.text)
          setInputPdfBytes(
            imported.fmt === 'pdf' ? (imported.bytes ?? null) : null
          )
          setInputDocxBytes(
            imported.fmt === 'docx' ? (imported.bytes ?? null) : null
          )
          setPreviewInput(true)
          if (imported.fmt === 'pdf' && !imported.text.trim()) {
            addToast({
              type: 'info',
              title: 'Imported PDF',
              message:
                'No extractable text (scanned/image PDF). Preview works; text conversions may be empty.'
            })
          } else {
            addToast({
              type: 'success',
              title: 'Imported',
              message: `${file.name} · ${FORMAT_LABELS[imported.fmt]}`
            })
          }
          return
        }

        const text = await file.text()
        setInputPdfBytes(null)
        setInputDocxBytes(null)
        if (guessed) {
          setFrom(guessed)
          setTo(await pickValidTo(guessed, to, text))
          if (guessed === 'md' || guessed === 'csv' || guessed === 'html') {
            setPreviewInput(true)
          }
        }
        setImportName(file.name)
        setInput(text)
        addToast({
          type: 'success',
          title: 'Imported',
          message: guessed
            ? `${file.name} · ${FORMAT_LABELS[guessed]}`
            : file.name
        })
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Could not import',
          message: e instanceof Error ? e.message : 'Could not read file'
        })
      }
    },
    [addToast, to]
  )

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void applyFile(file)
  }

  const saveOutput = async () => {
    if (!result.ok || (!result.text && result.data == null && !input.trim()))
      return
    setSaving(true)
    try {
      const defaultName = downloadBasename(importName, to)

      if (to === 'pdf') {
        let bytes = outputPdfBytes
        if (!bytes) {
          const data =
            result.data ??
            (input.trim()
              ? await parse(from, input, importName ?? undefined)
              : null)
          const htmlDoc = await contentToPrintableHtml({
            from,
            input,
            data
          })
          const built = await window.api.saveHtmlAsPdf({
            html: htmlDoc,
            preview: true
          })
          if (!(built.ok && 'preview' in built && built.preview)) {
            addToast({
              type: 'error',
              title: 'Could not save',
              message:
                !built.ok && 'error' in built
                  ? built.error
                  : 'Could not create PDF'
            })
            return
          }
          bytes = base64ToBytes(built.base64)
        }
        const r = await window.api.saveTextFile({
          content: bytesToBase64(bytes),
          defaultName,
          encoding: 'base64',
          filters: saveFiltersFor('pdf')
        })
        if (r.ok) {
          addToast({ type: 'success', title: 'Saved', message: r.name })
        } else if (!r.canceled) {
          addToast({
            type: 'error',
            title: 'Could not save',
            message: r.error
          })
        }
        return
      }

      let content = result.text
      let encoding: 'utf8' | 'base64' = 'utf8'

      if (to === 'docx' || to === 'xlsx') {
        const data =
          result.data ??
          (input.trim()
            ? await parse(from, input, importName ?? undefined)
            : null)
        if (data == null) return
        if (to === 'docx' && outputDocxBytes) {
          content = bytesToBase64(outputDocxBytes)
          encoding = 'base64'
        } else {
          const markdownSource =
            from === 'md' || from === 'docx' || from === 'pdf'
              ? input
              : from === 'html'
                ? await stringify('md', data)
                : undefined
          const bytes = await buildBinary(to, data, { markdownSource })
          content = bytesToBase64(bytes)
          encoding = 'base64'
        }
      }

      const r = await window.api.saveTextFile({
        content,
        defaultName,
        encoding,
        filters: saveFiltersFor(to)
      })
      if (r.ok) {
        addToast({ type: 'success', title: 'Saved', message: r.name })
      } else if (!r.canceled) {
        addToast({
          type: 'error',
          title: 'Could not save',
          message: r.error
        })
      }
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Could not save',
        message: e instanceof Error ? e.message : 'Conversion failed'
      })
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    result.ok &&
    (to === 'pdf'
      ? Boolean(input.trim()) && (!outputPdfLoading || outputPdfBytes != null)
      : to === 'docx'
        ? Boolean(input.trim()) &&
          (!outputDocxLoading || outputDocxBytes != null)
        : isBinaryFmt(to)
          ? result.data != null || Boolean(input.trim())
          : Boolean(result.text))

  const canCopy =
    result.ok && Boolean(result.text) && to !== 'pdf' && to !== 'docx'

  const inputPreviewContent =
    from === 'pdf' && inputPdfBytes ? (
      <PdfPagePreview data={inputPdfBytes} />
    ) : from === 'docx' && inputDocxBytes ? (
      <DocxPagePreview data={inputDocxBytes} />
    ) : (
      <FormatPreview fmt={from} text={input} />
    )

  const outputPreviewContent =
    to === 'pdf' ? (
      <PdfPagePreview
        data={outputPdfBytes}
        loading={outputPdfLoading}
        error={outputPdfError}
        emptyMessage="PDF preview will appear here…"
      />
    ) : to === 'docx' ? (
      <DocxPagePreview
        data={outputDocxBytes}
        loading={outputDocxLoading}
        error={outputDocxError}
        emptyMessage="Word preview will appear here…"
      />
    ) : (
      <FormatPreview fmt={to} text={result.ok ? result.text : ''} />
    )

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <ToolSeg
            options={fromOptions}
            value={from}
            onChange={(v) => {
              setFrom(v)
              clearImportLock()
            }}
            labels={FORMAT_LABELS}
            aria-label="Input format"
          />
          <span className="text-text-muted text-[13px]">→</span>
          <ToolSeg
            options={toOptions}
            value={toOptions.includes(to) ? to : toOptions[0]}
            onChange={setTo}
            labels={FORMAT_LABELS}
            aria-label="Output format"
          />
          <ToolDivider />
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void applyFile(file)
              }}
            />
            <ToolButton
              variant="ghost"
              title="Import a file"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="w-3.5 h-3.5" />
              Import
            </ToolButton>
            <ToolButton
              variant="ghost"
              title="Swap input and output"
              disabled={!result.ok || isBinaryFmt(to) || !canSwap}
              onClick={() => {
                if (!result.ok || isBinaryFmt(to)) return
                setInput(result.text)
                setFrom(to)
                setTo(from)
                clearImportLock()
                setPreviewInput(false)
                setPreviewOutput(false)
              }}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Swap
            </ToolButton>
            <ToolButton
              variant="ghost"
              disabled={!canSave || saving}
              title="Save converted output as a file"
              onClick={() => void saveOutput()}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </ToolButton>
            <ToolButton
              variant="primary"
              disabled={!canCopy}
              title="Copy converted output"
              onClick={() => {
                if (result.ok) void navigator.clipboard.writeText(result.text)
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Output
            </ToolButton>
            <ToolImmersiveButton />
          </span>
        </ToolToolbar>
      </WorkspaceToolbar>

      <div className="flex-1 min-h-0 grid gap-2 lg:grid-cols-2">
        <ToolPane
          title={`Input · ${FORMAT_LABELS[from]}`}
          className="min-h-0 h-full"
          badge={
            importName ? (
              <span className="text-[11px] text-text-muted truncate max-w-[10rem]">
                {importName}
              </span>
            ) : null
          }
          actions={
            <PreviewToggle
              active={previewInput}
              onToggle={() => setPreviewInput((v) => !v)}
            />
          }
          bodyClassName="p-0 h-full flex flex-col relative overflow-hidden"
        >
          <div
            className="relative flex-1 min-h-0 h-full overflow-hidden"
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              setDragOver(false)
            }}
            onDrop={onDrop}
          >
            {previewInput ? (
              <PreviewViewport
                contentKey={`in:${from}:${importName ?? ''}:${inputPdfBytes?.byteLength ?? 0}:${inputDocxBytes?.byteLength ?? 0}:${input.length}`}
              >
                {inputPreviewContent}
              </PreviewViewport>
            ) : cm ? (
              <FillCodeMirror
                CodeMirror={cm.CodeMirror}
                value={input}
                extensions={inputExtensions}
                onChange={(v) => {
                  setInput(v)
                  clearImportLock()
                }}
              />
            ) : (
              <p className="p-3 text-[12.5px] text-text-muted">Loading editor…</p>
            )}
            {dragOver && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-accent/10 border-2 border-dashed border-accent rounded-b-xl pointer-events-none">
                <FileUp className="w-7 h-7 text-accent" />
                <p className="text-[13px] font-medium text-accent">
                  Drop file to import
                </p>
              </div>
            )}
          </div>
        </ToolPane>

        <ToolPane
          title={`Output · ${FORMAT_LABELS[to]}`}
          className="min-h-0 h-full"
          actions={
            result.ok ? (
              <PreviewToggle
                active={previewOutput}
                onToggle={() => setPreviewOutput((v) => !v)}
              />
            ) : null
          }
          bodyClassName="p-0 h-full flex flex-col overflow-hidden"
        >
          {result.ok ? (
            previewOutput ? (
              <PreviewViewport
                contentKey={`out:${to}:${outputPdfBytes?.byteLength ?? 0}:${outputDocxBytes?.byteLength ?? 0}:${result.text.length}`}
                loading={
                  (to === 'pdf' && outputPdfLoading) ||
                  (to === 'docx' && outputDocxLoading)
                }
              >
                {outputPreviewContent}
              </PreviewViewport>
            ) : (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                {cm ? (
                <FillCodeMirror
                  CodeMirror={cm.CodeMirror}
                  value={
                    to === 'pdf' || to === 'docx'
                      ? `${FORMAT_LABELS[to]} binary — switch to Preview to see the document, or Download to save.`
                      : result.text
                  }
                  extensions={outputExtensions}
                  editable={false}
                />
                ) : (
                  <p className="p-3 text-[12.5px] text-text-muted">Loading editor…</p>
                )}
              </div>
            )
          ) : (
            <p className="p-4 text-[13px] text-danger">{result.error}</p>
          )}
        </ToolPane>
      </div>
    </ToolFullscreenShell>
  )
}
