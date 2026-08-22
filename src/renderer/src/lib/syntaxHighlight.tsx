import type { ReactNode } from 'react'

function span(className: string, text: string, key: number): ReactNode {
  return (
    <span key={key} className={className}>
      {text}
    </span>
  )
}

/** Color JSON / JS-ish literals for read-only panes. */
export function highlightJson(src: string): ReactNode {
  const re =
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g
  const parts: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push(src.slice(last, m.index))
    if (m[1]) {
      parts.push(span('text-info', m[1], i++))
      parts.push(span('text-text-muted', ':', i++))
    } else if (m[2]) parts.push(span('text-success', m[2], i++))
    else if (m[3]) parts.push(span('text-warning tabular-nums', m[3], i++))
    else if (m[4]) parts.push(span('text-accent', m[4], i++))
    else parts.push(span('text-text-muted', m[5], i++))
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts
}

/** Color tags / strings in HTML, CSS, or JS for read-only panes. */
export function highlightMarkup(src: string): ReactNode {
  const re =
    /(<\/?[a-zA-Z][^>\n]*>)|(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\'|[^'])*'|"(?:\\.|[^"\\])*"|`(?:\\`|[^`])*`)|(\b(?:const|let|var|function|return|if|else|for|while|class|import|export|await|async|true|false|null|undefined)\b)|([{}();,:])|(#[0-9a-fA-F]{3,8}\b)/g
  const parts: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push(src.slice(last, m.index))
    if (m[1]) parts.push(span('text-info', m[1], i++))
    else if (m[2]) parts.push(span('text-text-muted', m[2], i++))
    else if (m[3]) parts.push(span('text-success', m[3], i++))
    else if (m[4]) parts.push(span('text-accent', m[4], i++))
    else if (m[5]) parts.push(span('text-text-muted', m[5], i++))
    else parts.push(span('text-warning', m[6], i++))
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts.length ? parts : src
}

/** Highlight a formatted curl command (flags vs strings). */
export function highlightCurl(src: string): ReactNode {
  const parts: ReactNode[] = []
  let i = 0
  const re = /(\\\n)|('(?:\\'|[^'])*')|(-{1,2}[A-Za-z][\w-]*)|(curl)\b|(\s+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push(src.slice(last, m.index))
    if (m[1]) parts.push(span('text-text-muted', m[1], i++))
    else if (m[2]) parts.push(span('text-success', m[2], i++))
    else if (m[3]) parts.push(span('text-accent', m[3], i++))
    else if (m[4]) parts.push(span('text-info', m[4], i++))
    else parts.push(m[5])
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts.length ? parts : src
}

/** Highlight a fetch() snippet. */
export function highlightFetch(src: string): ReactNode {
  const re =
    /\b(await|fetch|method|headers|body)\b|('(?:\\'|[^'])*'|`(?:\\`|[^`])*`)|("(?:\\.|[^"\\])*")|([{}[\]:,])/g
  const parts: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) parts.push(src.slice(last, m.index))
    if (m[1]) parts.push(span('text-accent', m[1], i++))
    else if (m[2] || m[3]) parts.push(span('text-success', m[2] || m[3], i++))
    else parts.push(span('text-text-muted', m[4], i++))
    last = m.index + m[0].length
  }
  if (last < src.length) parts.push(src.slice(last))
  return parts.length ? parts : src
}

export function CodePane({
  children,
  className = ''
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <pre
      className={`h-full overflow-auto px-4 py-3 font-mono text-[12.5px] leading-5 whitespace-pre-wrap break-all text-text-primary ${className}`}
    >
      {children}
    </pre>
  )
}
