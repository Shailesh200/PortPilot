import type { ProfileWorkspace, TextToolId } from '../../../shared/types'
import { usePortStore } from '../stores/portStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUIStore } from '../stores/uiStore'

function applyWorkspace(ws?: ProfileWorkspace): void {
  if (!ws) return
  const ports = usePortStore.getState()
  if (ws.portView) ports.setPortView(ws.portView)
  if (typeof ws.groupByProject === 'boolean') {
    ports.setGroupByProject(ws.groupByProject)
  }
  if (typeof ws.hideSystemProcesses === 'boolean') {
    useSettingsStore.getState().updateSettings({
      hideSystemProcesses: ws.hideSystemProcesses
    })
  }
  if (ws.openOnActivate === 'ports') {
    useUIStore.getState().setNav({ module: 'ports', screen: 'dashboard' })
  } else if (ws.openOnActivate === 'text') {
    const tool: TextToolId = ws.textTool || 'json-formatter'
    useUIStore.getState().setNav({ module: 'text', screen: tool })
  } else if (ws.openOnActivate === 'database') {
    useUIStore.getState().setNav({
      module: 'database',
      screen: 'connections',
      connectionId: ws.connectionId
    })
  }
}

export function applyActiveProfileFilter(): void {
  const { activeProfileId, profiles } = useSettingsStore.getState()
  const pr =
    activeProfileId && profiles.find((p) => p.id === activeProfileId)
  if (pr) {
    usePortStore.getState().setProfileFilter(pr.favoritePorts)
    applyWorkspace(pr.workspace)
  } else {
    usePortStore.getState().setProfileFilter([])
  }
  usePortStore.getState().reapplyFiltersAndSort()
}
