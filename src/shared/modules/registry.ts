import type { ModuleId, TextToolId } from '../types'

export interface ModuleScreenMeta {
  id: string
  label: string
  description?: string
}

export interface ModuleDefinition {
  id: ModuleId
  label: string
  shortcut: string
  order: number
  description: string
  screens: ModuleScreenMeta[]
}

export const TEXT_TOOLS: {
  id: TextToolId
  label: string
  description: string
}[] = [
  {
    id: 'json-formatter',
    label: 'Formatter',
    description: 'Pretty-print JSON, HTML, CSS, JavaScript, and logs'
  },
  {
    id: 'json-diff',
    label: 'Diff',
    description: 'Compare JSON or plain text side by side'
  },
  {
    id: 'js-console',
    label: 'JS Sandbox',
    description: 'HTML, CSS, and JS with a live preview'
  },
  {
    id: 'format-converter',
    label: 'Format Converter',
    description: 'Convert JSON, YAML, CSV, Markdown, HTML, PDF, and more'
  },
  {
    id: 'encode-decode',
    label: 'Encode / Decode',
    description: 'Base64, URL, HTML entities, hex, and Unicode escapes'
  },
  {
    id: 'jwt-inspector',
    label: 'JWT Inspector',
    description: 'Decode header and payload, check exp / iat / nbf'
  },
  {
    id: 'url-curl',
    label: 'URL + cURL',
    description: 'Parse a URL or curl command, copy as fetch'
  },
  {
    id: 'regex',
    label: 'Regex Playground',
    description: 'Explain, highlight, and test patterns against many strings'
  },
  {
    id: 'time',
    label: 'Time bench',
    description: 'UTC, IST, local, EDT, epoch, and ISO conversions'
  },
  {
    id: 'clipboard',
    label: 'Clipboard',
    description: 'Searchable history of copied content'
  }
]

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'ports',
    label: 'Ports',
    shortcut: '⌘1',
    order: 1,
    description: 'Real-time local port and process control',
    screens: [
      { id: 'dashboard', label: 'Dashboard', description: 'Active ports table' },
      { id: 'heatmap', label: 'Heatmap', description: 'Port usage overview' }
    ]
  },
  {
    id: 'text',
    label: 'Text & Data',
    shortcut: '⌘2',
    order: 2,
    description: 'Formatters, diffs, converters, and clipboard',
    screens: [
      { id: 'landing', label: 'All tools' },
      ...TEXT_TOOLS.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description
      }))
    ]
  },
  {
    id: 'database',
    label: 'Database',
    shortcut: '⌘3',
    order: 3,
    description: 'Local DB client for Postgres, MySQL, SQLite, Turso, Redis, and MongoDB',
    screens: [
      { id: 'connections', label: 'Connections' },
      { id: 'tables', label: 'Table Browser' },
      { id: 'sql', label: 'SQL Editor' },
      { id: 'query-history', label: 'Query History' }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    shortcut: '⌘,',
    order: 99,
    description: 'App preferences',
    screens: [
      { id: 'general', label: 'General' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'safety', label: 'Safety' }
    ]
  }
]
