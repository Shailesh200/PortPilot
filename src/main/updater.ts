import { app, BrowserWindow, powerMonitor } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from './logger'
import type { UpdateInfo } from '../shared/types'
import { IpcChannel, IpcEvent } from '../shared/ipc'
import { handleInvoke, sendEvent } from './ipc-handle'
import { showNativeNotification } from './os/notifications'

const FIRST_CHECK_MS = 8_000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000
const RELEASE_OWNER = 'Shailesh200'
const RELEASE_REPO = 'PortPilot'

autoUpdater.logger = log
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.allowPrerelease = false

let ipcRegistered = false
let started = false
let downloaded = false
let lastPercent = -1
/** Matches AppSettings.autoUpdate; renderer syncs on launch. */
let autoUpdateEnabled = true
/** Only Restart PortPilot should apply a downloaded update. */
let userRequestedInstall = false
let state: UpdateInfo = {
  version: '',
  currentVersion: '',
  status: 'idle',
  canInstall: false
}

function canInstallUpdate(): boolean {
  if (process.mas) return false
  return app.isPackaged
}

function canCheckUpdates(): boolean {
  return !process.mas
}

function snapshot(): UpdateInfo {
  return {
    ...state,
    currentVersion: app.getVersion(),
    canInstall: canInstallUpdate()
  }
}

function broadcast(): void {
  const info = snapshot()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) sendEvent(win, IpcEvent.updateStatus, info)
  }
}

function setState(partial: Partial<UpdateInfo>): void {
  state = { ...snapshot(), ...partial }
  broadcast()
}

function versionFromTag(tag: string): string {
  return tag.replace(/^v/i, '').trim()
}

function compareVersions(a: string, b: string): number {
  const pa = versionFromTag(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = versionFromTag(b).split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

type ReleaseJson = {
  tag_name?: string
  draft?: boolean
  prerelease?: boolean
}

async function fetchLatestReleaseVersion(): Promise<string | null> {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'PortPilot'
  }
  const latestUrl = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases/latest`
  const latestRes = await fetch(latestUrl, { headers })
  if (latestRes.ok) {
    const data = (await latestRes.json()) as ReleaseJson
    if (typeof data.tag_name === 'string' && data.tag_name) {
      return versionFromTag(data.tag_name)
    }
  }
  const listUrl = `https://api.github.com/repos/${RELEASE_OWNER}/${RELEASE_REPO}/releases?per_page=10`
  const listRes = await fetch(listUrl, { headers })
  if (!listRes.ok) {
    throw new Error(`release check failed (${listRes.status})`)
  }
  const releases = (await listRes.json()) as ReleaseJson[]
  if (!Array.isArray(releases)) return null
  const published = releases.find(
    (r) => r.tag_name && !r.draft && !r.prerelease
  )
  return published?.tag_name ? versionFromTag(published.tag_name) : null
}

async function checkLatestRelease(): Promise<void> {
  const latest = await fetchLatestReleaseVersion()
  if (!latest) {
    setState({ version: '', status: 'not-available', message: undefined })
    return
  }
  if (compareVersions(latest, app.getVersion()) > 0) {
    lastPercent = -1
    setState({
      version: latest,
      status: 'available',
      percent: undefined,
      message: undefined
    })
    return
  }
  setState({ version: '', status: 'not-available', message: undefined })
}

async function runCheck(): Promise<void> {
  if (!canCheckUpdates()) {
    if (!downloaded) setState({ status: 'not-available', message: undefined })
    return
  }
  if (downloaded) return
  if (state.status === 'checking' || state.status === 'downloading') return
  setState({ status: 'checking', message: undefined })
  try {
    if (canInstallUpdate()) {
      await autoUpdater.checkForUpdates()
    } else {
      await checkLatestRelease()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn('Update check failed:', message)
    setState({ status: 'error', message: 'Could not check for updates.' })
  }
}

async function runDownload(): Promise<void> {
  if (!canInstallUpdate() || downloaded) return
  if (state.status === 'downloading') return
  try {
    setState({
      status: 'downloading',
      percent: typeof state.percent === 'number' ? state.percent : 0,
      message: undefined
    })
    await autoUpdater.downloadUpdate()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn('Update download failed:', message)
    setState({ status: 'error', message: 'Could not download the update.' })
  }
}

export function setAutoUpdateEnabled(enabled: boolean): void {
  autoUpdateEnabled = enabled
  if (enabled && canCheckUpdates() && !downloaded) void runCheck()
}

/** Swap in the downloaded update. Returns false if there is nothing to install. */
export function installUpdateAndQuit(): boolean {
  if (!downloaded || !canInstallUpdate() || !userRequestedInstall) return false
  try {
    autoUpdater.quitAndInstall(false, true)
    return true
  } catch (err) {
    log.error('quitAndInstall failed:', err)
    return false
  }
}

export function registerUpdaterIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  handleInvoke(IpcChannel.getUpdateStatus, () => snapshot())
  handleInvoke(IpcChannel.checkForUpdates, async () => {
    await runCheck()
    return snapshot()
  })
  handleInvoke(IpcChannel.downloadUpdate, async () => {
    await runDownload()
    return snapshot()
  })
  handleInvoke(IpcChannel.updateAutoUpdate, (_event, enabled) => {
    if (typeof enabled !== 'boolean') return
    setAutoUpdateEnabled(enabled)
  })
  handleInvoke(IpcChannel.quitAndInstall, () => {
    if (downloaded && canInstallUpdate()) {
      userRequestedInstall = true
      app.quit()
    }
  })
}

export function initAutoUpdater(_mainWindow: BrowserWindow): void {
  if (started) return
  started = true
  state.currentVersion = app.getVersion()
  state.canInstall = canInstallUpdate()

  if (!canCheckUpdates()) {
    setState({ status: 'disabled' })
    log.info('Skipping in-app updates (Mac App Store)')
    return
  }

  if (canInstallUpdate()) {
    autoUpdater.on('checking-for-update', () => {
      if (!downloaded) setState({ status: 'checking', message: undefined })
    })

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version)
      lastPercent = -1
      setState({
        version: info.version,
        status: 'available',
        percent: undefined,
        message: undefined
      })
    })

    autoUpdater.on('update-not-available', () => {
      if (downloaded) return
      setState({
        version: '',
        status: 'not-available',
        message: undefined
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      if (percent === lastPercent) return
      lastPercent = percent
      setState({
        status: 'downloading',
        percent,
        message: undefined
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version)
      downloaded = true
      setState({
        version: info.version,
        status: 'downloaded',
        percent: 100,
        message: undefined
      })
      showNativeNotification(
        'PortPilot update ready',
        `Version ${info.version} is ready. Restart PortPilot to finish updating.`
      )
    })

    autoUpdater.on('error', (err) => {
      log.error('Auto-updater error:', err)
      if (downloaded) return
      setState({
        status: 'error',
        message: 'Could not check for updates.'
      })
    })
  } else {
    log.info('Unpackaged build: version checks only (install requires a packaged app)')
  }

  const schedule = (): void => {
    if (!autoUpdateEnabled) return
    void runCheck()
  }
  setTimeout(schedule, FIRST_CHECK_MS)
  setInterval(schedule, CHECK_EVERY_MS)
  powerMonitor.on('resume', () => {
    setTimeout(schedule, 15_000)
  })
}
