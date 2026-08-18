'use strict'

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DROP_KEYS = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSAudioCaptureUsageDescription',
  'NSBluetoothAlwaysUsageDescription',
  'NSBluetoothPeripheralUsageDescription'
]

function appPlist(context) {
  const name = context.packager.appInfo.productFilename
  return path.join(context.appOutDir, `${name}.app`, 'Contents', 'Info.plist')
}

function plutil(args) {
  execFileSync('/usr/bin/plutil', args, { stdio: 'pipe' })
}

/**
 * Electron's default Info.plist claims camera, mic, Bluetooth, and
 * NSAllowsArbitraryLoads. App Review flags those the same way it flagged
 * network.server: capability present, no matching feature.
 */
async function sanitizeMasPlist(context) {
  if (context.electronPlatformName !== 'mas') return
  const plist = appPlist(context)
  if (!fs.existsSync(plist)) {
    throw new Error(`afterPack: MAS Info.plist missing at ${plist}`)
  }

  for (const key of DROP_KEYS) {
    try {
      plutil(['-remove', key, plist])
    } catch {
      /* key absent */
    }
  }

  plutil([
    '-replace',
    'NSAppTransportSecurity',
    '-json',
    JSON.stringify({ NSAllowsLocalNetworking: true }),
    plist
  ])
  plutil(['-replace', 'ElectronTeamID', '-string', 'ARDSWV5GD2', plist])
  plutil(['-replace', 'ITSAppUsesNonExemptEncryption', '-bool', 'NO', plist])
  plutil([
    '-replace',
    'NSHumanReadableCopyright',
    '-string',
    '2026 Shailesh Jha',
    plist
  ])
}

module.exports = sanitizeMasPlist
