/**
 * Shared IPC channel names — keep preload + main in sync.
 * Migrate handlers gradually to import from here instead of string literals.
 */
export const IpcChannel = {
  // Ports / process
  getPorts: 'get-ports',
  getProcessDetails: 'get-process-details',
  killProcess: 'kill-process',
  killProcesses: 'kill-processes',
  openInBrowser: 'open-in-browser',
  openInTerminal: 'open-in-terminal',
  openInVscode: 'open-in-vscode',
  restartProcess: 'restart-process',
  updatePollInterval: 'update-poll-interval',
  updateGlobalShortcut: 'update-global-shortcut',
  updateSafetySettings: 'update-safety-settings',
  updateAlertSettings: 'update-alert-settings',
  loadProfiles: 'load-profiles',
  saveProfiles: 'save-profiles',
  getAppVersion: 'get-app-version',
  quitAndInstall: 'quit-and-install',

  // Window
  windowIsFullScreen: 'window-is-full-screen',
  windowSetFullScreen: 'window-set-full-screen',
  windowToggleFullScreen: 'window-toggle-full-screen',

  // Clipboard
  clipboardGetHistory: 'clipboard-get-history',
  clipboardSetCapture: 'clipboard-set-capture',
  clipboardIsCaptureEnabled: 'clipboard-is-capture-enabled',
  clipboardPin: 'clipboard-pin',
  clipboardDelete: 'clipboard-delete',
  clipboardClear: 'clipboard-clear',
  clipboardWrite: 'clipboard-write',

  // Database
  dbListConnections: 'db-list-connections',
  dbListLive: 'db-list-live',
  dbSaveConnection: 'db-save-connection',
  dbDeleteConnection: 'db-delete-connection',
  dbConnect: 'db-connect',
  dbDisconnect: 'db-disconnect',
  dbQuery: 'db-query',
  dbTables: 'db-tables',
  dbTableSchema: 'db-table-schema',
  dbBrowseTable: 'db-browse-table',
  dbAnalyzeSql: 'db-analyze-sql',
  dbExplain: 'db-explain',
  dbSavedQueries: 'db-saved-queries',
  dbSaveQuery: 'db-save-query',
  dbDeleteSavedQuery: 'db-delete-saved-query',
  dbTableDdl: 'db-table-ddl',
  dbUpdateCell: 'db-update-cell',
  dbInsertRow: 'db-insert-row',
  dbImportCsv: 'db-import-csv',
  dbRedisKeys: 'db-redis-keys',
  dbRedisKey: 'db-redis-key',
  dbHistory: 'db-history',
  dbPickSqliteFile: 'db-pick-sqlite-file',
  dbPickSshKey: 'db-pick-ssh-key',
  dbAccessInfo: 'db-access-info',

  // Text snapshots / files
  textSnapshotsList: 'text-snapshots-list',
  textSnapshotsSave: 'text-snapshots-save',
  textSnapshotsUpdateLabel: 'text-snapshots-update-label',
  textSnapshotsDelete: 'text-snapshots-delete',
  saveTextFile: 'save-text-file',
  saveHtmlAsPdf: 'save-html-as-pdf'
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Main → renderer push channels */
export const IpcEvent = {
  portsUpdated: 'ports-updated',
  focusSearch: 'focus-search',
  profilesChanged: 'profiles-changed',
  openProfileCreator: 'open-profile-creator',
  navigateTo: 'navigate-to',
  updateStatus: 'update-status',
  appToast: 'app-toast',
  clipboardUpdated: 'clipboard-updated',
  textSnapshotsUpdated: 'text-snapshots-updated',
  windowFullScreenChanged: 'window-full-screen-changed'
} as const

export type IpcEventName = (typeof IpcEvent)[keyof typeof IpcEvent]
