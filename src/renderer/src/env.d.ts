/// <reference types="vite/client" />

import type { IpcApi } from '../../shared/ipc'

declare global {
  interface Window {
    api: IpcApi
  }
}
