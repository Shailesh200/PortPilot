import { lazy, Suspense } from 'react'
import {
  Braces,
  FileDiff,
  Terminal,
  Columns2,
  ArrowLeftRight,
  Binary,
  KeyRound,
  Link2,
  Regex,
  Clock,
  Clipboard,
  type LucideIcon
} from 'lucide-react'
import { TEXT_TOOLS } from '../../../../shared/modules/registry'
import type { TextToolId } from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { CategoryLanding } from '../../shell/CategoryLanding'
import { ModuleFrame } from '../../shell/ModuleFrame'

/** DevBench Text & Data category accent */
const TEXT_ACCENT = '#4F8CFF'

const TOOL_ICONS: Record<TextToolId, LucideIcon> = {
  'json-formatter': Braces,
  'json-diff': FileDiff,
  'js-console': Terminal,
  'text-diff': Columns2,
  'format-converter': ArrowLeftRight,
  'encode-decode': Binary,
  'jwt-inspector': KeyRound,
  'url-curl': Link2,
  regex: Regex,
  time: Clock,
  clipboard: Clipboard
}

const JsonFormatter = lazy(() =>
  import('./tools/JsonFormatter').then((m) => ({ default: m.JsonFormatter }))
)
const CombinedDiff = lazy(() =>
  import('./tools/CombinedDiff').then((m) => ({ default: m.CombinedDiff }))
)
const JsConsole = lazy(() =>
  import('./tools/JsConsole').then((m) => ({ default: m.JsConsole }))
)
const FormatConverter = lazy(() =>
  import('./tools/FormatConverter').then((m) => ({ default: m.FormatConverter }))
)
const EncodeDecode = lazy(() =>
  import('./tools/EncodeDecode').then((m) => ({ default: m.EncodeDecode }))
)
const JwtInspector = lazy(() =>
  import('./tools/JwtInspector').then((m) => ({ default: m.JwtInspector }))
)
const UrlCurlInspector = lazy(() =>
  import('./tools/UrlCurlInspector').then((m) => ({
    default: m.UrlCurlInspector
  }))
)
const RegexPlayground = lazy(() =>
  import('./tools/RegexPlayground').then((m) => ({
    default: m.RegexPlayground
  }))
)
const TimeBench = lazy(() =>
  import('./tools/TimeBench').then((m) => ({ default: m.TimeBench }))
)
const ClipboardModule = lazy(() =>
  import('../clipboard/ClipboardModule').then((m) => ({
    default: m.ClipboardModule
  }))
)

function ToolFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">
      Loading tool…
    </div>
  )
}

function renderTool(id: TextToolId) {
  switch (id) {
    case 'json-formatter':
      return <JsonFormatter />
    case 'json-diff':
    case 'text-diff':
      return <CombinedDiff preferText={id === 'text-diff'} />
    case 'js-console':
      return <JsConsole />
    case 'format-converter':
      return <FormatConverter />
    case 'encode-decode':
      return <EncodeDecode />
    case 'jwt-inspector':
      return <JwtInspector />
    case 'url-curl':
      return <UrlCurlInspector />
    case 'regex':
      return <RegexPlayground />
    case 'time':
      return <TimeBench />
    case 'clipboard':
      return <ClipboardModule />
  }
}

export function TextModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const pinned = useSettingsStore((s) => s.pinnedTextTools) ?? []
  const togglePin = useSettingsStore((s) => s.togglePinnedTextTool)
  const screen = nav.module === 'text' ? nav.screen : 'landing'
  const goTextHome = () => setNav({ module: 'text', screen: 'landing' })

  const landingItems = TEXT_TOOLS.map((t) => ({
    ...t,
    icon: TOOL_ICONS[t.id],
    pinned: pinned.includes(t.id)
  })).sort((a, b) => {
    const ai = pinned.indexOf(a.id)
    const bi = pinned.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  if (screen === 'landing') {
    return (
      <CategoryLanding
        title="Text & Data"
        subtitle="Format, convert and inspect text"
        accent={TEXT_ACCENT}
        items={landingItems}
        onSelect={(id) =>
          setNav({ module: 'text', screen: id as TextToolId })
        }
        onPin={(id) => togglePin(id as TextToolId)}
      />
    )
  }

  const meta =
    TEXT_TOOLS.find((t) => t.id === screen) ||
    (screen === 'text-diff'
      ? TEXT_TOOLS.find((t) => t.id === 'json-diff')
      : undefined)
  if (!meta) {
    return (
      <CategoryLanding
        title="Text & Data"
        subtitle="Format, convert and inspect text"
        accent={TEXT_ACCENT}
        items={landingItems}
        onSelect={(id) =>
          setNav({ module: 'text', screen: id as TextToolId })
        }
        onPin={(id) => togglePin(id as TextToolId)}
      />
    )
  }

  // Clipboard owns its ModuleFrame.
  if (screen === 'clipboard') {
    return (
      <Suspense fallback={<ToolFallback />}>
        <ClipboardModule />
      </Suspense>
    )
  }

  const workspaceTools: TextToolId[] = [
    'json-formatter',
    'json-diff',
    'js-console',
    'text-diff',
    'format-converter',
    'encode-decode',
    'jwt-inspector',
    'url-curl',
    'regex',
    'time'
  ]
  const variant = workspaceTools.includes(screen as TextToolId)
    ? 'workspace'
    : 'bench'

  return (
    <ModuleFrame
      variant={variant}
      title={meta.label}
      subtitle={meta.description}
      showBack
      backLabel="Text & Data"
      onBack={goTextHome}
    >
      <Suspense fallback={<ToolFallback />}>
        {renderTool(screen as TextToolId)}
      </Suspense>
    </ModuleFrame>
  )
}
