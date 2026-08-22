import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs'
import { dirname } from 'path'

/** tmp + rename so a crash mid-write can't leave a truncated file. */
export function writeJsonAtomic(
  target: string,
  data: unknown,
  opts?: { pretty?: boolean }
): void {
  const dir = dirname(target)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmp = `${target}.tmp`
  const body =
    opts?.pretty === false
      ? JSON.stringify(data)
      : JSON.stringify(data, null, 2)
  writeFileSync(tmp, body, 'utf-8')
  renameSync(tmp, target)
}

export function writeJsonAtomicSilent(
  target: string,
  data: unknown,
  opts?: { pretty?: boolean }
): void {
  try {
    writeJsonAtomic(target, data, opts)
  } catch {
    /* ignore */
  }
}
