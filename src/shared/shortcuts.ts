/**
 * Single source of truth for in-app keyboard shortcuts.
 * Settings → Shortcuts and docs should stay aligned with this list.
 */

export type ShortcutCategory =
  | 'Global'
  | 'Navigation'
  | 'Search'
  | 'Actions'
  | 'Table'
  | 'General'

export type AppShortcut = {
  id: string
  label: string
  /** Space-separated key chips for display (e.g. "⌘ K"). */
  keys: string
  category: ShortcutCategory
  /** When true, `keys` is replaced by formatAccelerator(globalShortcut). */
  fromGlobalShortcut?: boolean
}

export const APP_SHORTCUTS: AppShortcut[] = [
  {
    id: 'global-launcher',
    label: 'Global Launcher',
    keys: '⌘ ⌥ P',
    category: 'Global',
    fromGlobalShortcut: true
  },
  {
    id: 'command-palette',
    label: 'Command Palette',
    keys: '⌘ K',
    category: 'Global'
  },
  { id: 'nav-ports', label: 'Go to Ports', keys: '⌘ 1', category: 'Navigation' },
  {
    id: 'nav-text',
    label: 'Go to Text & Data',
    keys: '⌘ 2',
    category: 'Navigation'
  },
  {
    id: 'nav-database',
    label: 'Go to Database',
    keys: '⌘ 3',
    category: 'Navigation'
  },
  {
    id: 'nav-settings',
    label: 'Go to Settings',
    keys: '⌘ ,',
    category: 'Navigation'
  },
  { id: 'search-focus', label: 'Focus Search', keys: '/', category: 'Search' },
  { id: 'kill', label: 'Kill Selected Process', keys: 'K', category: 'Actions' },
  {
    id: 'restart',
    label: 'Restart Selected Process',
    keys: 'R',
    category: 'Actions'
  },
  {
    id: 'open-browser',
    label: 'Open in Browser',
    keys: 'O',
    category: 'Actions'
  },
  {
    id: 'open-terminal',
    label: 'Open Terminal',
    keys: 'T',
    category: 'Actions'
  },
  {
    id: 'open-vscode',
    label: 'Open in VS Code / Cursor',
    keys: 'V',
    category: 'Actions'
  },
  {
    id: 'quick-peek',
    label: 'Quick Peek (or Enter on focused row)',
    keys: 'Space · ↵',
    category: 'Actions'
  },
  { id: 'navigate-up', label: 'Move Up', keys: '↑', category: 'Table' },
  { id: 'navigate-down', label: 'Move Down', keys: '↓', category: 'Table' },
  { id: 'expand-row', label: 'Expand Row', keys: '→', category: 'Table' },
  {
    id: 'close-modal',
    label: 'Close / Dismiss',
    keys: 'Esc',
    category: 'General'
  }
]

/** Choices for Settings → General → App launcher shortcut. */
export const GLOBAL_SHORTCUT_OPTIONS: { value: string; label: string }[] = [
  { value: 'CommandOrControl+Alt+P', label: '⌘⌥P (default)' },
  { value: 'CommandOrControl+Shift+Space', label: '⌘⇧Space' },
  { value: 'CommandOrControl+Shift+L', label: '⌘⇧L' },
  {
    value: 'CommandOrControl+Shift+P',
    label: '⌘⇧P (conflicts with VS Code)'
  }
]

/** Electron accelerator → display chips, e.g. CommandOrControl+Alt+P → "⌘ ⌥ P". */
export function formatAccelerator(accelerator: string): string {
  const keyMap: Record<string, string> = {
    CommandOrControl: '⌘',
    CmdOrCtrl: '⌘',
    Command: '⌘',
    Control: '⌃',
    Ctrl: '⌃',
    Alt: '⌥',
    Option: '⌥',
    Shift: '⇧',
    Super: '⌘',
    Meta: '⌘',
    Plus: '+',
    Space: 'Space',
    Return: '↵',
    Enter: '↵',
    Escape: 'Esc',
    Esc: 'Esc'
  }
  return accelerator
    .split('+')
    .map((part) => keyMap[part] ?? part)
    .join(' ')
}

export function resolveAppShortcuts(globalShortcut: string): AppShortcut[] {
  const globalKeys = formatAccelerator(globalShortcut)
  return APP_SHORTCUTS.map((s) =>
    s.fromGlobalShortcut ? { ...s, keys: globalKeys } : s
  )
}

/** Markdown rows for README (pipe table body, no header). */
export function shortcutsMarkdownRows(globalShortcut: string): string[] {
  return resolveAppShortcuts(globalShortcut).map((s) => {
    const keys = s.keys.replace(/ · /g, ' / ')
    return `| \`${keys}\` | ${s.label} |`
  })
}
