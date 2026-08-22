export type TimeZoneId = 'local' | 'utc' | 'ist'

export const TIME_ZONES: {
  id: TimeZoneId
  label: string
  /** IANA zone; omit for the host timezone. */
  tz?: string
}[] = [
  { id: 'local', label: 'Local' },
  { id: 'utc', label: 'UTC', tz: 'UTC' },
  { id: 'ist', label: 'IST', tz: 'Asia/Kolkata' }
]

export type TimeSource = 'now' | 'epoch-s' | 'epoch-ms' | 'iso'

export interface TimeSnapshot {
  ms: number
  source: TimeSource
  prefer?: TimeZoneId
  utcISO: string
  istISO: string
  localISO: string
  utcDisplay: string
  istDisplay: string
  localDisplay: string
  epochSec: string
  epochMs: string
  rfc2822: string
  relative: string
}

const ZONE_QUERY: Record<string, TimeZoneId> = {
  utc: 'utc',
  gmt: 'utc',
  ist: 'ist',
  india: 'ist',
  kolkata: 'ist',
  local: 'local'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Offset of `timeZone` from UTC, in minutes, at instant `ms`. */
function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return Math.round((asUtc - ms) / 60_000)
}

function toOffsetISO(ms: number, timeZone?: string): string {
  if (!timeZone || timeZone === 'UTC') return new Date(ms).toISOString()
  const off = zoneOffsetMinutes(ms, timeZone)
  const shifted = new Date(ms + off * 60_000)
  const sign = off >= 0 ? '+' : '-'
  const abs = Math.abs(off)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export function isoInZone(ms: number, timeZone?: string): string {
  return toOffsetISO(
    ms,
    timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  )
}

function displayInZone(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone ?? undefined,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short'
  }).format(new Date(ms))
}

export type ClockParts = {
  time: string
  date: string
  offset: string
}

/** Split a timestamp into time / date / offset for the clock UI. */
export function clockParts(ms: number, timeZone?: string): ClockParts {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone ?? undefined,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'shortOffset'
    })
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  )
  return {
    time: `${bag.hour}:${bag.minute}:${bag.second}`,
    date: `${bag.weekday} ${bag.day} ${bag.month} ${bag.year}`,
    offset: (bag.timeZoneName || '').replace(/^GMT/, 'UTC')
  }
}

export function relativeTo(ms: number, now = Date.now()): string {
  const delta = ms - now
  const abs = Math.abs(delta)
  const sec = Math.round(abs / 1000)
  if (sec < 5) return 'now'
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  const unit =
    day >= 2 ? `${day}d` : hr >= 2 ? `${hr}h` : min >= 2 ? `${min}m` : `${sec}s`
  return delta >= 0 ? `in ${unit}` : `${unit} ago`
}

export function snapshotAt(
  ms: number,
  source: TimeSource,
  prefer?: TimeZoneId
): TimeSnapshot {
  return {
    ms,
    source,
    prefer,
    utcISO: toOffsetISO(ms, 'UTC'),
    istISO: toOffsetISO(ms, 'Asia/Kolkata'),
    localISO: toOffsetISO(ms, Intl.DateTimeFormat().resolvedOptions().timeZone),
    utcDisplay: displayInZone(ms, 'UTC'),
    istDisplay: displayInZone(ms, 'Asia/Kolkata'),
    localDisplay: displayInZone(ms),
    epochSec: String(Math.floor(ms / 1000)),
    epochMs: String(ms),
    rfc2822: new Date(ms).toUTCString(),
    relative: relativeTo(ms)
  }
}

function parseZoneToken(token: string): TimeZoneId | undefined {
  return ZONE_QUERY[token.toLowerCase()]
}

const NOW_RE =
  /^(?:now(?:\s+(utc|gmt|ist|india|kolkata|local))?|(utc|gmt|ist|india|kolkata|local)\s+now)$/i

const EPOCH_RE = /^-?\d{10,13}(?:\.\d+)?$/

function parseEpoch(raw: string): { ms: number; source: TimeSource } | null {
  if (!EPOCH_RE.test(raw)) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const digits = raw.replace(/^-/, '').split('.')[0].length
  if (digits >= 13 || Math.abs(n) >= 1e12) {
    const ms = Math.round(n)
    if (ms < 0 || ms > 4e12) return null
    return { ms, source: 'epoch-ms' }
  }
  const ms = Math.round(n * 1000)
  if (ms < 0 || ms > 4e12) return null
  return { ms, source: 'epoch-s' }
}

function parseIsoish(raw: string): number | null {
  if (raw.length < 8) return null
  if (!/\d{4}-\d{2}-\d{2}/.test(raw) && !/^\d{4}\/\d{2}\/\d{2}/.test(raw)) {
    const t = Date.parse(raw)
    if (!Number.isFinite(t)) return null
    // Bare English dates like "August 19 2026" are ok; reject random words.
    if (!/\d/.test(raw)) return null
    return t
  }
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : null
}

export function parseTimeQuery(
  raw: string,
  nowMs = Date.now()
): TimeSnapshot | null {
  const q = raw.trim()
  if (!q) return null

  const nowMatch = q.match(NOW_RE)
  if (nowMatch) {
    const zoneTok = nowMatch[1] || nowMatch[2]
    return snapshotAt(nowMs, 'now', zoneTok ? parseZoneToken(zoneTok) : undefined)
  }

  const epoch = parseEpoch(q)
  if (epoch) return snapshotAt(epoch.ms, epoch.source)

  const iso = parseIsoish(q)
  if (iso != null) return snapshotAt(iso, 'iso')

  return null
}

export function looksLikeTimeQuery(raw: string): boolean {
  const q = raw.trim()
  if (!q) return false
  if (/^(time|epoch|timezone|tz)$/i.test(q)) return true
  return parseTimeQuery(q) != null
}

export type TimeRowKind = 'iso' | 'epoch' | 'rfc' | 'wall' | 'sql' | 'js' | 'date'

export type TimeRow = {
  label: string
  value: string
  kind: TimeRowKind
  group: 'zones' | 'iso' | 'epoch' | 'code'
}

function sqlDateTime(ms: number, timeZone?: string): string {
  const iso = toOffsetISO(
    ms,
    timeZone === undefined
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : timeZone
  )
  return iso.replace('T', ' ').replace(/\.\d+/, '').replace(/[Z+-].*$/, '')
}

function isoDate(ms: number, timeZone?: string): string {
  return sqlDateTime(ms, timeZone).slice(0, 10)
}

function compactUtc(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

export function timeRows(snap: TimeSnapshot): TimeRow[] {
  const edtISO = toOffsetISO(snap.ms, 'America/New_York')
  const edtWall = displayInZone(snap.ms, 'America/New_York')
  const sqlUtc = sqlDateTime(snap.ms, 'UTC')
  const sqlLocal = sqlDateTime(snap.ms)
  const dateLocal = isoDate(snap.ms)
  const dateUtc = isoDate(snap.ms, 'UTC')
  return [
    { group: 'zones', kind: 'wall', label: 'Local', value: snap.localDisplay },
    { group: 'zones', kind: 'wall', label: 'UTC', value: snap.utcDisplay },
    { group: 'zones', kind: 'wall', label: 'IST', value: snap.istDisplay },
    { group: 'zones', kind: 'wall', label: 'EDT', value: edtWall },
    { group: 'iso', kind: 'iso', label: 'UTC ISO', value: snap.utcISO },
    { group: 'iso', kind: 'iso', label: 'IST ISO', value: snap.istISO },
    { group: 'iso', kind: 'iso', label: 'Local ISO', value: snap.localISO },
    { group: 'iso', kind: 'iso', label: 'EDT ISO', value: edtISO },
    { group: 'iso', kind: 'iso', label: 'Compact', value: compactUtc(snap.ms) },
    { group: 'epoch', kind: 'epoch', label: 'Epoch (s)', value: snap.epochSec },
    { group: 'epoch', kind: 'epoch', label: 'Epoch (ms)', value: snap.epochMs },
    {
      group: 'epoch',
      kind: 'epoch',
      label: 'Epoch (f)',
      value: (snap.ms / 1000).toFixed(3)
    },
    { group: 'code', kind: 'rfc', label: 'RFC 2822', value: snap.rfc2822 },
    { group: 'code', kind: 'sql', label: 'SQL UTC', value: sqlUtc },
    { group: 'code', kind: 'sql', label: 'SQL local', value: sqlLocal },
    { group: 'code', kind: 'date', label: 'Date UTC', value: dateUtc },
    { group: 'code', kind: 'date', label: 'Date', value: dateLocal },
    {
      group: 'code',
      kind: 'js',
      label: 'JS Date',
      value: `new Date(${snap.epochMs})`
    }
  ]
}
