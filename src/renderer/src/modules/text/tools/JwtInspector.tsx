import { useEffect, useMemo, useState } from 'react'
import { useTextToolSessionStore } from '../../../stores/textToolSessionStore'
import { useHandoffPayload } from '../../../hooks/useHandoffPayload'
import { WorkspaceToolbar } from '../../../shell/WorkspaceToolbar'
import { SplitPane } from '../../../shell/SplitPane'
import { ToolFullscreenShell } from './ToolWorkspaceExtras'
import {
  ToolBadge,
  ToolPane,
  ToolToggle,
  ToolToolbar
} from './toolUi'
import { ToolMonoTextarea, ToolPasteCopy } from './toolChrome'
import {
  CodePane,
  highlightJson
} from '../../../lib/syntaxHighlight'
import {
  jwtAlg,
  verifyJwtSignature,
  type JwtVerifyResult
} from '../../../lib/jwtVerify'

function b64urlToJson(part: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = decodeURIComponent(
      [...atob(b64)]
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    )
    return { ok: true, value: JSON.parse(json) }
  } catch {
    return { ok: false, error: 'Could not decode this segment' }
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function claimTime(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return v > 1e12 ? v : v * 1000
}

function formatClaimTime(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date(ms))
  } catch {
    return new Date(ms).toISOString()
  }
}

function relativeTo(ms: number, now: number): string {
  const delta = ms - now
  const abs = Math.abs(delta)
  const sec = Math.round(abs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  const unit =
    day >= 2 ? `${day}d` : hr >= 2 ? `${hr}h` : min >= 2 ? `${min}m` : `${sec}s`
  return delta >= 0 ? `in ${unit}` : `${unit} ago`
}

function verifyBadge(v: JwtVerifyResult): { tone: 'ok' | 'err' | 'warn'; label: string } | null {
  switch (v.status) {
    case 'ok':
      return { tone: 'ok', label: 'Signature verified' }
    case 'invalid':
      return { tone: 'err', label: 'Invalid signature' }
    case 'unsupported':
      return { tone: 'warn', label: `${v.alg} not supported` }
    case 'error':
      return { tone: 'err', label: 'Verify failed' }
    default:
      return null
  }
}

export function JwtInspector() {
  const saved = useTextToolSessionStore.getState().jwtInspector
  const patch = useTextToolSessionStore((s) => s.patchJwtInspector)
  const [token, setToken] = useState(saved.token)
  const [secret, setSecret] = useState(saved.secret ?? '')
  const [secretBase64, setSecretBase64] = useState(saved.secretBase64 ?? false)
  const [now, setNow] = useState(() => Date.now())
  const [verify, setVerify] = useState<JwtVerifyResult>({ status: 'empty' })
  const [splitPct, setSplitPct] = useState(48)
  const [stackPct, setStackPct] = useState(58)

  useHandoffPayload((payload) => setToken(payload.trim()))

  useEffect(() => {
    patch({ token, secret, secretBase64 })
  }, [token, secret, secretBase64, patch])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const parsed = useMemo(() => {
    const raw = token.trim()
    if (!raw) return null
    const parts = raw.split('.')
    if (parts.length < 2) {
      return { error: 'A JWT has two or three dot-separated parts' }
    }
    const header = b64urlToJson(parts[0])
    const payload = b64urlToJson(parts[1])
    if (!header.ok) return { error: `Header: ${header.error}` }
    if (!payload.ok) return { error: `Payload: ${payload.error}` }
    return {
      header: header.value,
      payload: payload.value,
      signature: parts[2] ?? '',
      parts,
      alg: jwtAlg(header.value)
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    void verifyJwtSignature(token, secret, { secretBase64 }).then((r) => {
      if (!cancelled) setVerify(r)
    })
    return () => {
      cancelled = true
    }
  }, [token, secret, secretBase64])

  const claims = parsed && 'payload' in parsed && isRecord(parsed.payload)
    ? parsed.payload
    : null

  const exp = claims ? claimTime(claims.exp) : null
  const iat = claims ? claimTime(claims.iat) : null
  const nbf = claims ? claimTime(claims.nbf) : null
  const expired = exp != null && exp < now
  const prettyHeader =
    parsed && 'header' in parsed
      ? JSON.stringify(parsed.header, null, 2)
      : ''
  const prettyPayload =
    parsed && 'payload' in parsed
      ? JSON.stringify(parsed.payload, null, 2)
      : ''
  const alg = parsed && 'alg' in parsed ? parsed.alg : ''
  const hmac = Boolean(alg && alg.startsWith('HS'))
  const sigBadge = verifyBadge(verify)

  return (
    <ToolFullscreenShell>
      <WorkspaceToolbar>
        <ToolToolbar className="mb-0">
          {parsed && 'error' in parsed && token.trim() && (
            <ToolBadge tone="err">Invalid</ToolBadge>
          )}
          {parsed && 'payload' in parsed && (
            <ToolBadge tone={expired ? 'err' : 'ok'}>
              {expired ? 'Expired' : 'Decoded'}
            </ToolBadge>
          )}
          {sigBadge && <ToolBadge tone={sigBadge.tone}>{sigBadge.label}</ToolBadge>}
          <ToolPasteCopy
            onPaste={(text) => setToken(text.trim())}
            copyText={prettyPayload}
            copyDisabled={!prettyPayload}
            copyLabel="Copy payload"
          />
        </ToolToolbar>
      </WorkspaceToolbar>

      <SplitPane
        axis="x"
        value={splitPct}
        onChange={setSplitPct}
        className="flex-1"
      >
        <div className="h-full min-h-0 flex flex-col gap-2">
          <ToolPane
            title="Encoded"
            className="flex-1 min-h-0"
            bodyClassName="p-0 h-full flex flex-col"
          >
            <ToolMonoTextarea
              className="break-all"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste a JWT…"
            />
            {parsed && 'header' in parsed && parsed.parts && (
              <p className="flex-shrink-0 px-4 pb-3 font-mono text-[11px] leading-5 break-all border-t border-border-subtle/60 pt-2">
                {parsed.parts.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-text-muted">.</span>}
                    <span
                      className={
                        i === 0
                          ? 'text-info'
                          : i === 1
                            ? 'text-accent'
                            : 'text-warning'
                      }
                    >
                      {p}
                    </span>
                  </span>
                ))}
              </p>
            )}
            {parsed && 'error' in parsed && token.trim() && (
              <p className="flex-shrink-0 border-t border-danger/25 bg-danger/10 px-4 py-2 text-[12px] text-danger">
                {parsed.error}
              </p>
            )}
          </ToolPane>
          <ToolPane
            title={hmac || !alg ? 'Verify signature' : `Verify · ${alg}`}
            className="flex-shrink-0"
            actions={
              hmac ? (
                <ToolToggle
                  label="secret base64"
                  checked={secretBase64}
                  onChange={setSecretBase64}
                />
              ) : null
            }
            bodyClassName="p-3"
          >
            <textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              spellCheck={false}
              rows={hmac ? 2 : 5}
              placeholder={
                hmac || !alg
                  ? 'HMAC secret (same as jwt.io)'
                  : 'Public key PEM (BEGIN PUBLIC KEY)'
              }
              className="w-full resize-y rounded-lg border border-border-subtle bg-transparent px-3 py-2 font-mono text-[12.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <p className="mt-1.5 text-[11px] text-text-muted">
              {verify.status === 'empty'
                ? 'Enter the secret or public key to check the signature'
                : verify.status === 'error'
                  ? verify.message
                  : hmac
                    ? 'HS256 / HS384 / HS512 — secret is never sent anywhere'
                    : 'RS256 / ES256 — paste the public key only'}
            </p>
          </ToolPane>
        </div>

        <div className="h-full min-h-0 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2 flex-shrink-0">
            {[
              ['iat', iat, 'Issued'],
              ['nbf', nbf, 'Not before'],
              ['exp', exp, 'Expires']
            ].map(([key, ms, label]) => (
              <div
                key={String(key)}
                className="rounded-xl border border-border-subtle bg-bg-card px-3 py-2"
              >
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  {String(label)}
                </p>
                <p className="mt-1 text-[12px] font-mono text-text-primary">
                  {typeof ms === 'number' ? formatClaimTime(ms) : '—'}
                </p>
                <p className="text-[11px] text-text-muted">
                  {typeof ms === 'number' ? relativeTo(ms, now) : ''}
                </p>
              </div>
            ))}
          </div>
          <SplitPane
            axis="y"
            value={stackPct}
            onChange={setStackPct}
            className="flex-1"
          >
            <ToolPane
              title="Header"
              className="h-full min-h-0"
              bodyClassName="p-0 h-full overflow-auto"
            >
              <CodePane>
                {prettyHeader ? highlightJson(prettyHeader) : '—'}
              </CodePane>
            </ToolPane>
            <ToolPane
              title="Payload"
              className="h-full min-h-0"
              bodyClassName="p-0 h-full overflow-auto"
            >
              <CodePane>
                {prettyPayload ? highlightJson(prettyPayload) : '—'}
              </CodePane>
            </ToolPane>
          </SplitPane>
        </div>
      </SplitPane>
    </ToolFullscreenShell>
  )
}
