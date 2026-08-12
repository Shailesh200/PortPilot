import { app, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

/** Resolve a file under the packaged `extraResources` tree or dev `resources/`. */
export function resolveResourcePath(...segments: string[]): string {
  const candidates: string[] = []
  if (app.isPackaged) {
    candidates.push(join(process.resourcesPath, 'resources', ...segments))
    candidates.push(join(process.resourcesPath, ...segments))
  }
  candidates.push(join(__dirname, '../../resources', ...segments))
  candidates.push(join(app.getAppPath(), 'resources', ...segments))
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return candidates[0]
}

export function resolveTrayIconPath(): string {
  return resolveResourcePath('iconTemplate.png')
}

export function loadTrayNativeImage(): Electron.NativeImage {
  const path = resolveTrayIconPath()
  const img = nativeImage.createFromPath(path)
  if (img.isEmpty()) {
    // Retina template naming for macOS menu bar
    const retina = resolveResourcePath('iconTemplate@2x.png')
    if (existsSync(retina)) {
      return nativeImage.createFromPath(retina)
    }
  }
  return img
}
