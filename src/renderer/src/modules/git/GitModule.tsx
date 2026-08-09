import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { GitScreen } from '../../../../shared/types'
import { useUIStore } from '../../stores/uiStore'
import { usePortStore } from '../../stores/portStore'
import { ModuleFrame } from '../../shell/ModuleFrame'
import { ToolButton } from '../text/tools/toolUi'

const tabs: { id: GitScreen; label: string }[] = [
  { id: 'changes', label: 'Changes' },
  { id: 'branches', label: 'Branches' },
  { id: 'history', label: 'History' },
  { id: 'stash', label: 'Stash' },
  { id: 'blame', label: 'Blame' }
]

export function GitModule() {
  const nav = useUIStore((s) => s.nav)
  const setNav = useUIStore((s) => s.setNav)
  const addToast = useUIStore((s) => s.addToast)
  const ports = usePortStore((s) => s.ports)
  const screen = nav.module === 'git' ? nav.screen : 'changes'
  const [repo, setRepo] = useState(
    nav.module === 'git' ? nav.repoPath || '' : ''
  )
  const [status, setStatus] = useState<{
    files: { path: string; index: string; working_dir: string }[]
    current?: string
  } | null>(null)
  const [diff, setDiff] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [commitMsg, setCommitMsg] = useState('feat: ')
  const [branches, setBranches] = useState<{
    all: string[]
    current: string
  } | null>(null)
  const [log, setLog] = useState<
    { hash: string; message: string; author_name: string; date: string }[]
  >([])
  const [stash, setStash] = useState<{ hash: string; message: string }[]>([])
  const [blameFile, setBlameFile] = useState('')
  const [blame, setBlame] = useState('')

  const refresh = useCallback(async () => {
    if (!repo) return
    try {
      const s = (await window.api.gitStatus(repo)) as {
        files: { path: string; index: string; working_dir: string }[]
        current: string
      }
      setStatus(s)
      const b = (await window.api.gitBranches(repo)) as {
        all: string[]
        current: string
      }
      setBranches(b)
      const l = (await window.api.gitLog(repo)) as {
        all: {
          hash: string
          message: string
          author_name: string
          date: string
        }[]
      }
      setLog(l.all || [])
      const st = (await window.api.gitStashList(repo)) as {
        hash: string
        message: string
      }[]
      setStash(Array.isArray(st) ? st : [])
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Git error',
        message: e instanceof Error ? e.message : String(e)
      })
    }
  }, [repo, addToast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (repo || !ports.length) return
    const withPath = ports.find((p) => p.projectPath)
    if (withPath?.projectPath) {
      void window.api.gitResolveRoot(withPath.projectPath).then((root) => {
        if (root) setRepo(root)
      })
    }
  }, [ports, repo])

  const pickRepo = async () => {
    const root = await window.api.gitPickRepo()
    if (root) {
      setRepo(root)
      setNav({ module: 'git', screen, repoPath: root }, false)
    }
  }

  const openDiff = async (file: string, staged: boolean) => {
    setSelectedFile(file)
    setDiff(await window.api.gitDiff(repo, file, staged))
  }

  return (
    <ModuleFrame
      title="Git"
      subtitle={repo || 'No repository selected'}
      toolbar={
        <>
          <ToolButton onClick={pickRepo}>Open repo</ToolButton>
          <ToolButton onClick={() => void refresh()}>Refresh</ToolButton>
        </>
      }
    >
      <div className="h-full flex flex-col min-h-0">
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                setNav({ module: 'git', screen: t.id, repoPath: repo }, false)
              }
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                screen === t.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-bg-hover'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!repo ? (
          <div className="p-8 text-center">
            <p className="text-sm text-text-muted mb-3">
              Open a git repository to get started
            </p>
            <ToolButton variant="primary" onClick={pickRepo}>
              Choose folder
            </ToolButton>
          </div>
        ) : screen === 'changes' ? (
          <div className="flex-1 grid grid-cols-[280px_1fr] min-h-0">
            <div className="border-r border-border-subtle overflow-y-auto p-2">
              {(status?.files || []).map((f) => (
                <button
                  key={f.path}
                  onClick={() =>
                    void openDiff(f.path, f.index !== ' ' && f.index !== '?')
                  }
                  className={clsx(
                    'w-full text-left px-2 py-1.5 rounded-md text-xs font-mono truncate',
                    selectedFile === f.path
                      ? 'bg-accent/10 text-accent'
                      : 'hover:bg-bg-hover'
                  )}
                >
                  <span className="text-warning mr-1">
                    {f.index}
                    {f.working_dir}
                  </span>
                  {f.path}
                </button>
              ))}
              <div className="mt-3 space-y-2 px-1">
                <input
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  className="w-full bg-bg-elevated border border-border-strong rounded-md px-2 py-1.5 text-xs"
                  placeholder="feat: conventional commit"
                />
                <div className="flex gap-1">
                  <ToolButton
                    onClick={async () => {
                      if (!selectedFile) return
                      await window.api.gitStage(repo, [selectedFile])
                      void refresh()
                    }}
                  >
                    Stage
                  </ToolButton>
                  <ToolButton
                    onClick={async () => {
                      if (!selectedFile) return
                      await window.api.gitUnstage(repo, [selectedFile])
                      void refresh()
                    }}
                  >
                    Unstage
                  </ToolButton>
                  <ToolButton
                    variant="primary"
                    onClick={async () => {
                      await window.api.gitCommit(repo, commitMsg)
                      addToast({ type: 'success', title: 'Committed' })
                      setCommitMsg('feat: ')
                      void refresh()
                    }}
                  >
                    Commit
                  </ToolButton>
                </div>
              </div>
            </div>
            <pre className="overflow-auto p-4 text-xs font-mono whitespace-pre-wrap">
              {diff || 'Select a file to view diff'}
            </pre>
          </div>
        ) : screen === 'branches' ? (
          <div className="p-4 overflow-y-auto space-y-1">
            {(branches?.all || []).map((b) => (
              <button
                key={b}
                onClick={async () => {
                  const name = b.replace(/^\*?\s*/, '').split(' ')[0]
                  try {
                    await window.api.gitCheckout(repo, name)
                    void refresh()
                  } catch (e) {
                    addToast({
                      type: 'error',
                      title: 'Checkout failed',
                      message: String(e)
                    })
                  }
                }}
                className={clsx(
                  'w-full text-left px-3 py-2 rounded-lg text-xs font-mono',
                  b.includes(branches?.current || '')
                    ? 'bg-accent/10 text-accent'
                    : 'hover:bg-bg-hover'
                )}
              >
                {b}
              </button>
            ))}
          </div>
        ) : screen === 'history' ? (
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {log.map((c) => (
              <button
                key={c.hash}
                onClick={async () => {
                  setDiff(await window.api.gitShow(repo, c.hash))
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-bg-hover border border-transparent hover:border-border-subtle"
              >
                <p className="text-sm text-text-primary">{c.message}</p>
                <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                  {c.hash.slice(0, 7)} · {c.author_name} · {c.date}
                </p>
              </button>
            ))}
            {diff && (
              <pre className="mt-3 p-3 text-xs font-mono bg-bg-card rounded-xl border border-border-subtle whitespace-pre-wrap">
                {diff}
              </pre>
            )}
          </div>
        ) : screen === 'stash' ? (
          <div className="p-4 space-y-2">
            {stash.length === 0 && (
              <p className="text-xs text-text-muted">No stashes</p>
            )}
            {stash.map((s, i) => (
              <div
                key={s.hash || i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle"
              >
                <span className="flex-1 text-xs font-mono truncate">
                  {s.message || `stash@{${i}}`}
                </span>
                <ToolButton
                  onClick={async () => {
                    await window.api.gitStashApply(repo, i)
                    void refresh()
                  }}
                >
                  Apply
                </ToolButton>
                <ToolButton
                  onClick={async () => {
                    await window.api.gitStashPop(repo, i)
                    void refresh()
                  }}
                >
                  Pop
                </ToolButton>
                <ToolButton
                  variant="danger"
                  onClick={async () => {
                    await window.api.gitStashDrop(repo, i)
                    void refresh()
                  }}
                >
                  Drop
                </ToolButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col p-4 gap-2 min-h-0">
            <div className="flex gap-2">
              <input
                value={blameFile}
                onChange={(e) => setBlameFile(e.target.value)}
                placeholder="path/to/file.ts"
                className="flex-1 bg-bg-elevated border border-border-strong rounded-md px-3 py-1.5 text-xs font-mono"
              />
              <ToolButton
                variant="primary"
                onClick={async () => {
                  setBlame(await window.api.gitBlame(repo, blameFile))
                }}
              >
                Blame
              </ToolButton>
            </div>
            <pre className="flex-1 overflow-auto text-[10px] font-mono bg-bg-card border border-border-subtle rounded-xl p-3 whitespace-pre-wrap">
              {blame || 'Enter a file path relative to the repo root'}
            </pre>
          </div>
        )}
      </div>
    </ModuleFrame>
  )
}
