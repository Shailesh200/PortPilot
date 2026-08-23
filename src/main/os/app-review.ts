import { existsSync, readFileSync } from 'fs'
import { MAC_APP_STORE_REVIEW_URL } from '../../shared/app-store'
import { writeJsonAtomicSilent } from './atomic-json'
import { showMessageBox } from './dialogs'
import { isMacAppStore, userDataFile } from './paths'
import { openExternal } from './shell'
import log from '../logger'

const MIN_SUCCESSES = 3
const PROMPT_DELAY_MS = 1800
const LATER_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

type ReviewState = {
  successfulActions: number
  lastPromptAt: number | null
  ratedAt: number | null
}

const DEFAULT_STATE: ReviewState = {
  successfulActions: 0,
  lastPromptAt: null,
  ratedAt: null
}

let promptTimer: ReturnType<typeof setTimeout> | null = null
let promptOpen = false

function statePath(): string {
  return userDataFile('app-review.json')
}

function loadState(): ReviewState {
  try {
    if (!existsSync(statePath())) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(readFileSync(statePath(), 'utf-8')) as Partial<ReviewState>
    return {
      successfulActions:
        typeof parsed.successfulActions === 'number' && parsed.successfulActions >= 0
          ? Math.floor(parsed.successfulActions)
          : 0,
      lastPromptAt: typeof parsed.lastPromptAt === 'number' ? parsed.lastPromptAt : null,
      ratedAt: typeof parsed.ratedAt === 'number' ? parsed.ratedAt : null
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveState(state: ReviewState): void {
  writeJsonAtomicSilent(statePath(), state)
}

function eligible(state: ReviewState, now: number): boolean {
  if (state.ratedAt) return false
  if (state.successfulActions < MIN_SUCCESSES) return false
  if (state.lastPromptAt != null && now - state.lastPromptAt < LATER_COOLDOWN_MS) return false
  return true
}

async function promptNow(): Promise<void> {
  if (promptOpen || !isMacAppStore()) return
  const state = loadState()
  const now = Date.now()
  if (!eligible(state, now)) return

  promptOpen = true
  try {
    const { response } = await showMessageBox({
      type: 'question',
      buttons: ['Rate PortPilot', 'Not now'],
      defaultId: 1,
      cancelId: 1,
      title: 'PortPilot',
      message: 'Enjoying PortPilot?',
      detail:
        'A short rating on the App Store helps other developers find it. You can skip this.'
    })
    const next = loadState()
    next.lastPromptAt = Date.now()
    if (response === 0) {
      next.ratedAt = Date.now()
      saveState(next)
      try {
        await openExternal(MAC_APP_STORE_REVIEW_URL)
      } catch (err) {
        log.warn('Could not open App Store review page:', err)
      }
    } else {
      saveState(next)
    }
  } catch (err) {
    log.warn('App review prompt failed:', err)
  } finally {
    promptOpen = false
  }
}

/** Count a successful kill/restart. MAS only; Apple still caps native review UI. */
export function noteSuccessfulProcessAction(): void {
  if (!isMacAppStore()) return
  const state = loadState()
  if (state.ratedAt) return
  state.successfulActions += 1
  saveState(state)
  if (!eligible(state, Date.now())) return
  if (promptTimer) clearTimeout(promptTimer)
  promptTimer = setTimeout(() => {
    promptTimer = null
    void promptNow()
  }, PROMPT_DELAY_MS)
}
