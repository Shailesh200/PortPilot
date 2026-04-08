import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { Profile, ProfilesPersistState } from '../shared/types'

const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    icon: '🎨',
    favoritePorts: [5173, 3000, 4321, 5174],
    filters: {},
    autoActions: {}
  },
  {
    id: 'backend',
    name: 'Backend',
    icon: '⚙️',
    favoritePorts: [8000, 5000, 4000, 5432],
    filters: {},
    autoActions: {}
  }
]

function filePath(): string {
  return join(app.getPath('userData'), 'portpilot-profiles.json')
}

export function loadProfilesState(): ProfilesPersistState {
  try {
    const p = filePath()
    if (!existsSync(p)) {
      return { profiles: [...DEFAULT_PROFILES], activeProfileId: null }
    }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<ProfilesState>
    if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) {
      return { profiles: [...DEFAULT_PROFILES], activeProfileId: null }
    }
    return {
      profiles: raw.profiles.map((p) => ({
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
      })),
      activeProfileId:
        typeof raw.activeProfileId === 'string' ? raw.activeProfileId : null
    }
  } catch {
    return { profiles: [...DEFAULT_PROFILES], activeProfileId: null }
  }
}

export function saveProfilesState(state: ProfilesPersistState): void {
  try {
    writeFileSync(
      filePath(),
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
