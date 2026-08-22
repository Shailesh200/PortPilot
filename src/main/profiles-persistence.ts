import { readFileSync, existsSync } from 'fs'
import { userDataFile, writeJsonAtomicSilent } from './os'
import type { Profile, ProfileWorkspace, ProfilesPersistState, TextToolId } from '../shared/types'
import { DEFAULT_PROFILES, LEGACY_DEFAULT_PROFILE_IDS } from '../shared/defaults'

const TEXT_TOOL_IDS = new Set<TextToolId>([
  'json-formatter',
  'json-diff',
  'js-console',
  'text-diff',
  'format-converter',
  'encode-decode',
  'jwt-inspector',
  'url-curl',
  'regex',
  'time',
  'clipboard'
])

function normalizeWorkspace(raw: unknown): ProfileWorkspace | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const ws: ProfileWorkspace = {}
  if (typeof o.hideSystemProcesses === 'boolean') {
    ws.hideSystemProcesses = o.hideSystemProcesses
  }
  if (o.portView === 'listen' || o.portView === 'connections') {
    ws.portView = o.portView
  }
  if (typeof o.groupByProject === 'boolean') {
    ws.groupByProject = o.groupByProject
  }
  if (typeof o.textTool === 'string' && TEXT_TOOL_IDS.has(o.textTool as TextToolId)) {
    ws.textTool = o.textTool as TextToolId
  }
  if (typeof o.connectionId === 'string' && o.connectionId) {
    ws.connectionId = o.connectionId
  }
  if (typeof o.converterFrom === 'string') ws.converterFrom = o.converterFrom
  if (typeof o.converterTo === 'string') ws.converterTo = o.converterTo
  if (
    o.openOnActivate === 'ports' ||
    o.openOnActivate === 'text' ||
    o.openOnActivate === 'database'
  ) {
    ws.openOnActivate = o.openOnActivate
  }
  return Object.keys(ws).length > 0 ? ws : undefined
}

function filePath(): string {
  return userDataFile('portpilot-profiles.json')
}

function defaultState(): ProfilesPersistState {
  return {
    profiles: DEFAULT_PROFILES.map((p) => ({ ...p, favoritePorts: [...p.favoritePorts] })),
    activeProfileId: null
  }
}

function normalizeProfile(p: Partial<Profile>): Profile | null {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return null
  return {
    id: String(p.id),
    name: String(p.name),
    icon: String(p.icon || '🔧'),
    favoritePorts: Array.isArray(p.favoritePorts)
      ? p.favoritePorts.filter(
          (n: unknown) => typeof n === 'number' && n > 0 && n <= 65535
        )
      : [],
    filters: typeof p.filters === 'object' && p.filters ? p.filters : {},
    autoActions:
      typeof p.autoActions === 'object' && p.autoActions ? p.autoActions : {},
    workspace: normalizeWorkspace(p.workspace)
  }
}

function stripLegacyDefaults(profiles: Profile[]): {
  profiles: Profile[]
  changed: boolean
} {
  const next = profiles.filter((p) => !LEGACY_DEFAULT_PROFILE_IDS.has(p.id))
  return { profiles: next, changed: next.length !== profiles.length }
}

function readFromDisk(): ProfilesPersistState {
  try {
    const p = filePath()
    if (!existsSync(p)) {
      return defaultState()
    }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<ProfilesPersistState>
    if (!Array.isArray(raw.profiles)) {
      return defaultState()
    }
    const normalized = raw.profiles
      .map((pr) => normalizeProfile(pr as Partial<Profile>))
      .filter((pr): pr is Profile => pr != null)
    const { profiles, changed } = stripLegacyDefaults(normalized)
    let activeProfileId =
      typeof raw.activeProfileId === 'string' ? raw.activeProfileId : null
    if (activeProfileId && !profiles.some((pr) => pr.id === activeProfileId)) {
      activeProfileId = null
    }
    const state: ProfilesPersistState = { profiles, activeProfileId }
    // Persist the strip so Frontend/Backend don't keep coming back
    if (changed) {
      writeJsonAtomicSilent(p, state)
    }
    return state
  } catch {
    return defaultState()
  }
}

// The main process is the single writer for this file; keeping an in-memory
// copy means renderer saves and tray "Add to profile" mutations can't
// silently overwrite each other with stale snapshots.
let cachedState: ProfilesPersistState | null = null

export function loadProfilesState(): ProfilesPersistState {
  if (!cachedState) {
    cachedState = readFromDisk()
  }
  return cachedState
}

export function saveProfilesState(state: ProfilesPersistState): void {
  cachedState = state
  writeJsonAtomicSilent(filePath(), {
    profiles: state.profiles,
    activeProfileId: state.activeProfileId
  })
}

export function addPortToProfileFile(
  profileId: string,
  port: number
): ProfilesPersistState {
  const state = loadProfilesState()
  const profiles = state.profiles.map((p) =>
    p.id === profileId && !p.favoritePorts.includes(port)
      ? {
          ...p,
          favoritePorts: [...p.favoritePorts, port].sort((a, b) => a - b)
        }
      : p
  )
  const next: ProfilesPersistState = { ...state, profiles }
  saveProfilesState(next)
  return next
}
