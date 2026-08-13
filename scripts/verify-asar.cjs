'use strict'

const fs = require('fs')
const path = require('path')

/**
 * Fail the pack if app.asar file offsets are scrambled.
 * A growing builder log in the project root (from `tee`) used to get packed
 * into the archive and shift every file — the app then exited on launch.
 */
module.exports = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context
  const name = packager.appInfo.productFilename
  const asarPath =
    electronPlatformName === 'darwin'
      ? path.join(appOutDir, `${name}.app/Contents/Resources/app.asar`)
      : path.join(appOutDir, 'resources', 'app.asar')

  if (!fs.existsSync(asarPath)) {
    throw new Error(`afterPack: app.asar missing at ${asarPath}`)
  }

  const asar = require(
    require.resolve('@electron/asar', {
      paths: [path.dirname(require.resolve('app-builder-lib/package.json'))]
    })
  )

  const pkg = asar.extractFile(asarPath, 'package.json').toString('utf8')
  const main = asar.extractFile(asarPath, 'out/main/index.js').toString('utf8')

  if (!pkg.trim().startsWith('{')) {
    throw new Error(
      'Corrupt app.asar: package.json is not JSON. Refusing to ship this build.'
    )
  }
  const mainHead = main.trimStart().slice(0, 32)
  if (!mainHead.startsWith('"use strict"') && !mainHead.startsWith("'use strict'")) {
    throw new Error(
      `Corrupt app.asar: out/main/index.js starts with ${JSON.stringify(mainHead)}`
    )
  }
}
