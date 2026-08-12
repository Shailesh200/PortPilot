import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/** PortPilot-skinned CodeMirror chrome (follows CSS theme tokens). */
export function portpilotEditorTheme(dark: boolean) {
  return EditorView.theme(
    {
      '.cm-scroller': {
        fontFamily:
          "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, monospace",
        lineHeight: '1.55',
        overflow: 'auto',
        overscrollBehavior: 'contain'
      },
      '&': {
        height: '100%',
        maxHeight: '100%',
        fontSize: '13px',
        backgroundColor: 'transparent',
        color: 'rgb(var(--text-primary))',
        overflow: 'hidden'
      },
      '.cm-content': {
        caretColor: 'rgb(var(--text-primary))',
        padding: '12px 0'
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: '#6366f1'
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        {
          backgroundColor: 'rgb(99 102 241 / 0.28)'
        },
      '.cm-activeLine': {
        backgroundColor: 'rgb(var(--bg-hover) / 0.45)'
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'rgb(var(--text-muted))',
        border: 'none',
        borderRight: '1px solid rgb(var(--border-subtle))',
        minWidth: '2.75rem'
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgb(var(--bg-hover) / 0.45)',
        color: 'rgb(var(--text-secondary))'
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 10px 0 8px',
        minWidth: '2.5rem'
      },
      '.cm-foldGutter .cm-gutterElement': {
        padding: '0 4px'
      },
      '.cm-tooltip': {
        backgroundColor: 'rgb(var(--bg-elevated))',
        color: 'rgb(var(--text-primary))',
        border: '1px solid rgb(var(--border-strong))',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgb(0 0 0 / 0.25)'
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'rgb(99 102 241 / 0.2)',
        color: 'rgb(var(--text-primary))'
      },
      '.cm-matchingBracket, .cm-nonmatchingBracket': {
        backgroundColor: 'rgb(99 102 241 / 0.22)',
        outline: '1px solid rgb(99 102 241 / 0.45)'
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'rgb(var(--bg-elevated))',
        border: 'none',
        color: 'rgb(var(--text-muted))'
      },
      '.cm-searchMatch': {
        backgroundColor: 'rgb(245 158 11 / 0.25)'
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'rgb(245 158 11 / 0.45)'
      }
    },
    { dark }
  )
}

const darkHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#c792ea' },
  { tag: t.operator, color: '#89ddff' },
  { tag: t.bool, color: '#c792ea' },
  { tag: t.null, color: '#c792ea' },
  { tag: t.number, color: '#f5c26b' },
  { tag: t.string, color: '#7ecfa2' },
  { tag: t.regexp, color: '#89ddff' },
  { tag: t.comment, color: '#6b7280', fontStyle: 'italic' },
  { tag: t.definition(t.variableName), color: '#82aaff' },
  { tag: t.variableName, color: '#e4e4e7' },
  { tag: t.propertyName, color: '#82aaff' },
  { tag: t.function(t.variableName), color: '#82aaff' },
  { tag: t.className, color: '#ffcb6b' },
  { tag: t.typeName, color: '#ffcb6b' },
  { tag: t.bracket, color: '#a1a1aa' },
  { tag: t.punctuation, color: '#a1a1aa' },
  { tag: t.meta, color: '#89ddff' },
  { tag: t.heading, color: '#c792ea', fontWeight: 'bold' },
  { tag: t.link, color: '#89ddff' },
  { tag: t.url, color: '#7ecfa2' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, color: '#f5c26b' },
  { tag: t.invalid, color: '#ef4444' }
])

const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#7c3aed' },
  { tag: t.operator, color: '#0284c7' },
  { tag: t.bool, color: '#7c3aed' },
  { tag: t.null, color: '#7c3aed' },
  { tag: t.number, color: '#b45309' },
  { tag: t.string, color: '#047857' },
  { tag: t.regexp, color: '#0369a1' },
  { tag: t.comment, color: '#9ca3af', fontStyle: 'italic' },
  { tag: t.definition(t.variableName), color: '#2563eb' },
  { tag: t.variableName, color: '#18181b' },
  { tag: t.propertyName, color: '#2563eb' },
  { tag: t.function(t.variableName), color: '#2563eb' },
  { tag: t.className, color: '#b45309' },
  { tag: t.typeName, color: '#b45309' },
  { tag: t.bracket, color: '#71717a' },
  { tag: t.punctuation, color: '#71717a' },
  { tag: t.meta, color: '#0369a1' },
  { tag: t.heading, color: '#7c3aed', fontWeight: 'bold' },
  { tag: t.link, color: '#0369a1' },
  { tag: t.url, color: '#047857' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.monospace, color: '#b45309' },
  { tag: t.invalid, color: '#dc2626' }
])

export function portpilotHighlight(dark: boolean) {
  return syntaxHighlighting(dark ? darkHighlight : lightHighlight)
}
