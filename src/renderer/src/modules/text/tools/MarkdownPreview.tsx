import { useMemo, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ToolPane, monoArea } from './toolUi'

export function MarkdownPreview() {
  const [md, setMd] = useState(
    '# PortPilot\n\nPorts-first workbench.\n\n- JSON tools\n- Clipboard\n- Git & DB\n'
  )

  const html = useMemo(() => {
    const raw = marked.parse(md, { async: false }) as string
    return DOMPurify.sanitize(raw)
  }, [md])

  return (
    <div className="h-full grid grid-cols-2 gap-3 p-4 min-h-0">
      <ToolPane title="Editor">
        <textarea
          className={monoArea}
          value={md}
          onChange={(e) => setMd(e.target.value)}
          spellCheck={false}
        />
      </ToolPane>
      <ToolPane title="Preview">
        <div
          className="prose prose-invert prose-sm max-w-none px-4 py-3 text-text-primary
            [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold
            [&_a]:text-accent [&_code]:font-mono [&_code]:text-xs
            [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ToolPane>
    </div>
  )
}
