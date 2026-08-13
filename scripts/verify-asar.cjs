'use strict'

const fs = require('fs')
const path = require('path')

function findAsar(appOutDir, productName, platform) {
  const candidates = [
    path.join(appOutDir, `${productName}.app`, 'Contents', 'Resources', 'app.asar'),
    path.join(appOutDir, 'resources', 'app.asar'),
    path.join(appOutDir, 'app.asar')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  const stack = [appOutDir]
  while (stack.length) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isFile() && ent.name === 'app.asar') return full
      if (ent.isDirectory() && ent.name !== 'node_modules') stack.push(full)
    }
  }
  throw new Error(
    `afterPack: app.asar missing (platform=${platform} appOutDir=${appOutDir})`
  )
}

function extractUtf8(asar, asarPath, file) {
  const variants = [file, file.replace(/\//g, '\\'), `/${file}`]
  let lastErr
  for (const name of variants) {
    try {
      return asar.extractFile(asarPath, name).toString('utf8')
    } catch (err) {
      lastErr = err
    }
  }
  let listed = '(unable to list)'
  try {
    listed = asar.listPackage(asarPath).slice(0, 40).join(', ')
  } catch {
    /* ignore */
  }
  throw new Error(
    `afterPack: could not read ${file} from ${asarPath}: ${
      lastErr && lastErr.message
    }. sample=${listed}`
  )
}

async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context
  const asarPath = findAsar(
    appOutDir,
    packager.appInfo.productFilename,
    electronPlatformName
  )
  const asar = require(
    require.resolve('@electron/asar', {
      paths: [path.dirname(require.resolve('app-builder-lib/package.json'))]
    })
  )

  const pkg = extractUtf8(asar, asarPath, 'package.json')
  const main = extractUtf8(asar, asarPath, 'out/main/index.js')

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

module.exports = afterPack
module.exports.afterPack = afterPack
