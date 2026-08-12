import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Profile, ProfilesPersistState } from '../shared/types'
import { DEFAULT_PROFILES, LEGACY_DEFAULT_PROFILE_IDS } from '../shared/defaults'

function filePath(): string {
  return join(app.getPath('userData'), 'portpilot-profiles.json')
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
      typeof p.autoActions === 'object' && p.autoActions ? p.autoActions : {}
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
      try {
        writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8')
      } catch {
        /* ignore */
      }
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
  try {
    const target = filePath()
    const tmp = `${target}.tmp`
    // tmp + rename so a crash mid-write can't leave a truncated file
    writeFileSync(
      tmp,
      JSON.stringify(
        {
          profiles: state.profiles,
          activeProfileId: state.activeProfileId
        },
        null,
        2
      ),
      'utf-8'
    )
    renameSync(tmp, target)
  } catch {
    /* ignore */
  }
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
