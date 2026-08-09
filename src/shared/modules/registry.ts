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
    description: 'Format, validate, and explore JSON in a tree view'
  },
  {
    id: 'json-diff',
    label: 'JSON Diff',
    description: 'Semantic and line-by-line comparison of two JSON docs'
  },
  {
    id: 'jq-playground',
    label: 'jq Playground',
    description: 'Live jq / JSONPath queries against JSON input'
  },
  {
    id: 'text-diff',
    label: 'Text Diff',
    description: 'Unified or split comparison of plain text'
  },
  {
    id: 'format-converter',
    label: 'Format Converter',
    description: 'Convert between YAML, JSON, TOML, XML, and CSV'
  },
  {
    id: 'csv-viewer',
    label: 'CSV Viewer',
    description: 'Open, filter, sort, and export tabular data'
  },
  {
    id: 'regex-tester',
    label: 'Regex Tester',
    description: 'Live matches, capture groups, and pattern notes'
  },
  {
    id: 'markdown-preview',
    label: 'Markdown Preview',
    description: 'Edit Markdown beside a live rendered preview'
  },
  {
    id: 'escape-unescape',
    label: 'Escape / Unescape',
    description: 'URL, HTML, SQL, shell, and JSON string escaping'
  },
  {
    id: 'unicode-inspector',
    label: 'Unicode Inspector',
    description: 'Codepoints, entities, and glyph details'
  },
  {
    id: 'fake-data',
    label: 'Fake Data Generator',
    description: 'Generate names, emails, and more as JSON, CSV, or SQL (en-IN)'
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
      { id: 'heatmap', label: 'Heatmap', description: 'Port usage overview' },
      { id: 'logs', label: 'Logs', description: 'Process log viewer' }
    ]
  },
  {
    id: 'text',
    label: 'Text & Data',
    shortcut: '⌘2',
    order: 2,
    description: 'Formatters, diffs, converters, and generators',
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
    id: 'clipboard',
    label: 'Clipboard',
    shortcut: '⌘3',
    order: 3,
    description: 'History and smart transforms for copied content',
    screens: [
      {
        id: 'history',
        label: 'History',
        description: 'Searchable clipboard history with pins'
      },
      {
        id: 'transforms',
        label: 'Smart Transforms',
        description: 'Detect content and offer actions'
      }
    ]
  },
  {
    id: 'database',
    label: 'Database',
    shortcut: '⌘4',
    order: 4,
    description: 'Local DB client for Postgres, MySQL, SQLite, and Redis',
    screens: [
      { id: 'connections', label: 'Connections' },
      { id: 'tables', label: 'Table Browser' },
      { id: 'sql', label: 'SQL Editor' },
      { id: 'query-history', label: 'Query History' }
    ]
  },
  {
    id: 'git',
    label: 'Git',
    shortcut: '⌘5',
    order: 5,
    description: 'Changes, branches, history, stash, and blame',
    screens: [
      { id: 'changes', label: 'Changes' },
      { id: 'branches', label: 'Branches' },
      { id: 'history', label: 'History' },
      { id: 'stash', label: 'Stash' },
      { id: 'blame', label: 'Blame' }
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

export function getModule(id: ModuleId): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find((m) => m.id === id)
}
