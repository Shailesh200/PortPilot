import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** execFile that never rejects — non-zero exits and missing binaries yield empty stdout. */
export async function execFileSafe(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(cmd, args)
  } catch {
    return { stdout: '', stderr: '' }
  }
}
