import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { EventMap, InvokeMap, InvokeChannel, EventChannel } from '../shared/ipc'

/** Typed ipcRenderer.invoke — args/result come from InvokeMap. */
export function invoke<C extends InvokeChannel>(
  channel: C,
  ...args: InvokeMap[C]['args']
): Promise<InvokeMap[C]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<InvokeMap[C]['result']>
}

/** Typed subscribe helper — returns an unsubscribe function. */
export function onEvent<E extends EventChannel>(
  channel: E,
  callback: (payload: EventMap[E]) => void
): () => void {
  const handler = (_event: IpcRendererEvent, payload: EventMap[E]) => {
    callback(payload)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}
