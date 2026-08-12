import { clipboard } from 'electron'

export function readClipboardText(): string {
  return clipboard.readText()
}

export function writeClipboardText(text: string): void {
  clipboard.writeText(text)
}
