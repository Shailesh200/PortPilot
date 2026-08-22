import { useState, type ReactNode } from 'react'
import { JsonDiff } from './JsonDiff'
import { TextDiff } from './TextDiff'
import { ToolSeg } from './toolUi'

export function CombinedDiff({ preferText = false }: { preferText?: boolean }) {
  const [kind, setKind] = useState<'json' | 'text'>(preferText ? 'text' : 'json')
  const kindSeg: ReactNode = (
    <ToolSeg
      options={['json', 'text'] as const}
      value={kind}
      onChange={setKind}
      labels={{ json: 'JSON', text: 'Text' }}
    />
  )
  return (
    <div className="h-full min-h-0">
      {kind === 'json' ? (
        <JsonDiff leadingControls={kindSeg} />
      ) : (
        <TextDiff leadingControls={kindSeg} />
      )}
    </div>
  )
}
