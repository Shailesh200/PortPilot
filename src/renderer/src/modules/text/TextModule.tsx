import {
  Braces,
  FileDiff,
  Terminal,
  Columns2,
  ArrowLeftRight,
  Clipboard,
  type LucideIcon
} from 'lucide-react'
import { TEXT_TOOLS } from '../../../../shared/modules/registry'
import type { TextToolId } from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { CategoryLanding } from '../../shell/CategoryLanding'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { JsonFormatter } from './tools/JsonFormatter'
import { JsonDiff } from './tools/JsonDiff'
import { JsConsole } from './tools/JsConsole'
import { TextDiff } from './tools/TextDiff'
import { FormatConverter } from './tools/FormatConverter'
import { ClipboardModule } from '../clipboard/ClipboardModule'

/** DevBench Text & Data category accent */
const TEXT_ACCENT = '#4F8CFF'

const TOOL_ICONS: Record<TextToolId, LucideIcon> = {
  'json-formatter': Braces,
  'json-diff': FileDiff,
  'js-console': Terminal,
  'text-diff': Columns2,
  'format-converter': ArrowLeftRight,
  clipboard: Clipboard
}

function renderTool(id: TextToolId) {
  switch (id) {
    case 'json-formatter':
      return <JsonFormatter />
    case 'json-diff':
      return <JsonDiff />
    case 'js-console':
      return <JsConsole />
    case 'text-diff':
      return <TextDiff />
    case 'format-converter':
      return <FormatConverter />
    case 'clipboard':
      return <ClipboardModule />
  }
}

export function TextModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const screen = nav.module === 'text' ? nav.screen : 'landing'
  const goTextHome = () => setNav({ module: 'text', screen: 'landing' })

  if (screen === 'landing') {
    return (
      <CategoryLanding
        title="Text & Data"
        subtitle="Format, convert and inspect text"
        accent={TEXT_ACCENT}
        items={TEXT_TOOLS.map((t) => ({
          ...t,
          icon: TOOL_ICONS[t.id]
        }))}
        onSelect={(id) =>
          setNav({ module: 'text', screen: id as TextToolId })
        }
      />
    )
  }

  const meta = TEXT_TOOLS.find((t) => t.id === screen)
  if (!meta) {
    return (
      <CategoryLanding
        title="Text & Data"
        subtitle="Format, convert and inspect text"
        accent={TEXT_ACCENT}
        items={TEXT_TOOLS.map((t) => ({
          ...t,
          icon: TOOL_ICONS[t.id]
        }))}
        onSelect={(id) =>
          setNav({ module: 'text', screen: id as TextToolId })
        }
      />
    )
  }

  // Clipboard owns its ModuleFrame.
  if (screen === 'clipboard') {
    return <ClipboardModule />
  }

  const workspaceTools: TextToolId[] = [
    'json-formatter',
    'json-diff',
    'js-console',
    'text-diff',
    'format-converter'
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
      {renderTool(screen as TextToolId)}
    </ModuleFrame>
  )
}
