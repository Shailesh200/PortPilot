/** Shared JSON parse / format helpers for Text tools. */

export type ParseOk = { ok: true; value: unknown }
export type ParseErr = { ok: false; error: string }
export type ParseResult = ParseOk | ParseErr

export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text.trim() ? text : 'null') }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Invalid JSON'
    }
  }
}

/** Deep-sort object keys (arrays keep order; values recurse). */
export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value as object)
      .sort()
      .reduce(
        (acc, k) => {
          acc[k] = sortJsonKeys((value as Record<string, unknown>)[k])
          return acc
        },
        {} as Record<string, unknown>
      )
  }
  return value
}

export function formatJson(
  value: unknown,
  indent: number | string = 2,
  sortKeys = false
): string {
  const v = sortKeys ? sortJsonKeys(value) : value
  const spaces = typeof indent === 'string' ? indent : indent
  return JSON.stringify(v, null, spaces)
}

export function countNodes(value: unknown): number {
  if (value === null || typeof value !== 'object') return 1
  const kids = Array.isArray(value) ? value : Object.values(value)
  return 1 + kids.reduce<number>((n, child) => n + countNodes(child), 0)
}

export function isJsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortJsonKeys(a)) === JSON.stringify(sortJsonKeys(b))
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
