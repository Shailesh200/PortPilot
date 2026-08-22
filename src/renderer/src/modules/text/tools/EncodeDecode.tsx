import { useEffect, useMemo, useState } from 'react'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import { useHandoffPayload } from '../../../hooks/useHandoffPayload'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import {
  ToolBadge,
  ToolPane,
  ToolSeg,
  ToolToolbar
} from './toolUi'
import { ToolFullscreenShell } from './ToolWorkspaceExtras'
import { SplitPane } from '../../../shell/SplitPane'
import {
  ToolMonoTextarea,
  ToolPasteCopy
} from './toolChrome'
import {
  detectEncodeKind,
  ENCODE_KINDS,
  ENCODE_LABELS,
  transformEncode,
  type EncodeKind
} from './encodeDecodeCore'

export function EncodeDecode() {
  const saved = useTextToolSessionStore.getState().encodeDecode
  const patch = useTextToolSessionStore((s) => s.patchEncodeDecode)
  const [input, setInput] = useState(saved.input)
  const [kind, setKind] = useState<EncodeKind>(saved.kind)
  const [mode, setMode] = useState<'encode' | 'decode'>(saved.mode)
  const [splitPct, setSplitPct] = useState(50)

  useHandoffPayload((payload) => {
    setInput(payload)
    const detected = detectEncodeKind(payload)
    if (detected) {
      setKind(detected)
      setMode('decode')
    }
  })

  useEffect(() => {
    patch({ input, kind, mode })
  }, [input, kind, mode, patch])

  const result = useMemo(
    () => transformEncode(kind, input, mode === 'decode'),
    [kind, input, mode]
  )

  const applyPasted = (text: string) => {
    setInput(text)
    const detected = detectEncodeKind(text)
    if (detected) {
      setKind(detected)
      setMode('decode')
    }
  }

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          <ToolSeg
            options={['encode', 'decode'] as const}
            value={mode}
            onChange={setMode}
            labels={{ encode: 'Encode', decode: 'Decode' }}
          />
          <ToolSeg
            options={ENCODE_KINDS}
            value={kind}
            onChange={setKind}
            labels={ENCODE_LABELS}
          />
          <ToolPasteCopy
            onPaste={applyPasted}
            copyText={result.ok ? result.output : ''}
            copyDisabled={!result.ok || !result.output}
          />
        </ToolToolbar>
      </WorkspaceToolbar>

      <SplitPane
        axis="x"
        value={splitPct}
        onChange={setSplitPct}
        className="flex-1"
      >
        <ToolPane
          className="h-full min-h-0"
          title={mode === 'decode' ? 'Encoded' : 'Plain'}
          bodyClassName="p-0 h-full flex flex-col"
        >
          <ToolMonoTextarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text, Base64, a URL, hex…"
          />
        </ToolPane>
        <ToolPane
          className="h-full min-h-0"
          title={mode === 'decode' ? 'Decoded' : 'Encoded'}
          actions={
            result.ok ? (
              <ToolBadge tone="ok">{ENCODE_LABELS[kind]}</ToolBadge>
            ) : (
              <ToolBadge tone="err">Failed</ToolBadge>
            )
          }
          bodyClassName="p-0 h-full flex flex-col"
        >
          {result.ok ? (
            <ToolMonoTextarea readOnly value={result.output} />
          ) : (
            <p className="px-4 py-3 text-[13px] text-danger">{result.error}</p>
          )}
        </ToolPane>
      </SplitPane>
    </ToolFullscreenShell>
  )
}
