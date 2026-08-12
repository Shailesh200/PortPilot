import { shell } from 'electron'

/** Open a URL or file path with the OS default handler. */
export function openExternal(target: string): Promise<void> {
  return shell.openExternal(target)
}
