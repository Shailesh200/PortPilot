'use strict'

/**
 * Mac App Store package. Uses 3rd Party Mac Developer identities in the
 * login keychain. Unset Developer ID / notarize env so a leftover CSC_LINK
 * cannot sign this as a GitHub DMG.
 */
delete process.env.CSC_LINK
delete process.env.CSC_KEY_PASSWORD
delete process.env.APPLE_API_KEY
delete process.env.APPLE_API_KEY_ID
delete process.env.APPLE_API_ISSUER
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'true'

const { spawnSync } = require('child_process')
const r = spawnSync(
  process.execPath,
  [
    require.resolve('electron-builder/cli.js'),
    '--mac',
    'mas',
    '--arm64',
    '--publish',
    'never',
    ...process.argv.slice(2)
  ],
  { stdio: 'inherit', env: process.env }
)
process.exit(r.status === null ? 1 : r.status)
