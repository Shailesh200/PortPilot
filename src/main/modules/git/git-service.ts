import simpleGit, { type SimpleGit, type StatusResult } from 'simple-git'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

function git(cwd: string): SimpleGit {
  return simpleGit({ baseDir: cwd, trimmed: true })
}

export async function gitIsAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version'])
    return true
  } catch {
    return false
  }
}

export async function gitStatus(cwd: string): Promise<StatusResult> {
  return git(cwd).status()
}

export async function gitDiff(
  cwd: string,
  file?: string,
  staged = false
): Promise<string> {
  const g = git(cwd)
  if (staged) return g.diff(['--cached', ...(file ? [file] : [])])
  return g.diff([...(file ? [file] : [])])
}

export async function gitStage(cwd: string, files: string[]): Promise<void> {
  await git(cwd).add(files)
}

export async function gitUnstage(cwd: string, files: string[]): Promise<void> {
  await git(cwd).reset(['HEAD', '--', ...files])
}

export async function gitCommit(
  cwd: string,
  message: string
): Promise<string> {
  const r = await git(cwd).commit(message)
  return r.commit
}

export async function gitBranches(cwd: string) {
  return git(cwd).branch(['-vv', '--all'])
}

export async function gitCheckout(cwd: string, branch: string): Promise<void> {
  await git(cwd).checkout(branch)
}

export async function gitLog(cwd: string, max = 80) {
  return git(cwd).log({ maxCount: max, format: {
    hash: '%H',
    date: '%aI',
    message: '%s',
    author_name: '%an',
    body: '%b'
  }})
}

export async function gitShow(cwd: string, hash: string): Promise<string> {
  return git(cwd).show([hash, '--stat', '--format=fuller'])
}

export async function gitStashList(cwd: string) {
  const out = await git(cwd).stashList()
  return out.all
}

export async function gitStashApply(cwd: string, index: number): Promise<void> {
  await git(cwd).stash(['apply', `stash@{${index}}`])
}

export async function gitStashPop(cwd: string, index: number): Promise<void> {
  await git(cwd).stash(['pop', `stash@{${index}}`])
}

export async function gitStashDrop(cwd: string, index: number): Promise<void> {
  await git(cwd).stash(['drop', `stash@{${index}}`])
}

export async function gitBlame(cwd: string, file: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['blame', '--line-porcelain', file], {
    cwd,
    maxBuffer: 10 * 1024 * 1024
  })
  return stdout
}

export async function gitRevParse(cwd: string): Promise<string | null> {
  try {
    const root = await git(cwd).revparse(['--show-toplevel'])
    return root.trim()
  } catch {
    return null
  }
}
