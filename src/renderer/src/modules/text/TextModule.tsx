import { TEXT_TOOLS } from '../../../../shared/modules/registry'
import type { TextToolId } from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { CategoryLanding } from '../../shell/CategoryLanding'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { JsonFormatter } from './tools/JsonFormatter'
import { JsonDiff } from './tools/JsonDiff'
import { JqPlayground } from './tools/JqPlayground'
import { TextDiff } from './tools/TextDiff'
import { FormatConverter } from './tools/FormatConverter'
import { CsvViewer } from './tools/CsvViewer'
import { RegexTester } from './tools/RegexTester'
import { MarkdownPreview } from './tools/MarkdownPreview'
import { EscapeUnescape } from './tools/EscapeUnescape'
import { UnicodeInspector } from './tools/UnicodeInspector'
import { FakeDataGenerator } from './tools/FakeDataGenerator'

function renderTool(id: TextToolId) {
  switch (id) {
    case 'json-formatter':
      return <JsonFormatter />
    case 'json-diff':
      return <JsonDiff />
    case 'jq-playground':
      return <JqPlayground />
    case 'text-diff':
      return <TextDiff />
    case 'format-converter':
      return <FormatConverter />
    case 'csv-viewer':
      return <CsvViewer />
    case 'regex-tester':
      return <RegexTester />
    case 'markdown-preview':
      return <MarkdownPreview />
    case 'escape-unescape':
      return <EscapeUnescape />
    case 'unicode-inspector':
      return <UnicodeInspector />
    case 'fake-data':
      return <FakeDataGenerator />
  }
}

export function TextModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const screen = nav.module === 'text' ? nav.screen : 'landing'

  if (screen === 'landing') {
    return (
      <CategoryLanding
        title="Text & Data"
        subtitle="Formatters, diffs, converters, and generators"
        items={TEXT_TOOLS}
        onSelect={(id) =>
          setNav({ module: 'text', screen: id as TextToolId })
        }
      />
    )
  }

  const meta = TEXT_TOOLS.find((t) => t.id === screen)
  return (
    <ModuleFrame
      title={meta?.label || screen}
      subtitle={meta?.description}
      showBack
    >
      {renderTool(screen)}
    </ModuleFrame>
  )
}
