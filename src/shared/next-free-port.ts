/** First unused TCP port at or after `from` (default 3000), skipping used listeners. */
export function nextFreePort(
  used: Iterable<number>,
  from = 3000,
  max = 65535
): number | null {
  const taken = new Set<number>()
  for (const p of used) taken.add(p)
  const start = Math.min(Math.max(1, Math.floor(from)), max)
  for (let p = start; p <= max; p++) {
    if (!taken.has(p)) return p
  }
  return null
}
