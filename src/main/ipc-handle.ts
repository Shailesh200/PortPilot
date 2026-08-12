import {
  BrowserWindow,
  ipcMain,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron'
import type { EventMap, InvokeMap, InvokeChannel, EventChannel } from '../shared/ipc'

type HandleListener<C extends InvokeChannel> = (
  event: IpcMainInvokeEvent,
  ...args: InvokeMap[C]['args']
) => Promise<InvokeMap[C]['result']> | InvokeMap[C]['result']

/** Typed ipcMain.handle bound to InvokeMap. */
export function handleInvoke<C extends InvokeChannel>(
  channel: C,
  listener: HandleListener<C>
): void {
  ipcMain.handle(
    channel,
    listener as (
      event: IpcMainInvokeEvent,
      ...args: unknown[]
    ) => Promise<unknown> | unknown
  )
}

/** Typed webContents.send for EventMap channels with a payload. */
export function sendEvent<E extends EventChannel>(
  target: BrowserWindow | WebContents,
  channel: E,
  ...payload: EventMap[E] extends undefined ? [] : [EventMap[E]]
): void {
  const contents = 'webContents' in target ? target.webContents : target
  if (contents.isDestroyed()) return
  contents.send(channel, ...(payload as unknown[]))
}
