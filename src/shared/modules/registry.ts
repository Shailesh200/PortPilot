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
    label: 'JSON Formatter',
    description: 'Clean and beautify messy JSON data'
  },
  {
    id: 'json-diff',
    label: 'JSON Diff',
    description: 'Compare two JSON files and see differences'
  },
  {
    id: 'js-console',
    label: 'JS Console',
    description: 'Run JavaScript like a browser console'
  },
  {
    id: 'text-diff',
    label: 'Text Diff',
    description: 'Find changes between two blocks of text'
  },
  {
    id: 'format-converter',
    label: 'Format Converter',
    description: 'Convert JSON, YAML, CSV, Markdown, HTML, PDF, and more'
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
    description: 'App preferences and profiles',
    screens: [
      { id: 'general', label: 'General' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'safety', label: 'Safety' },
      { id: 'profiles', label: 'Profiles' }
    ]
  }
]
