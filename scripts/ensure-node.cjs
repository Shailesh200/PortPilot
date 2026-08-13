'use strict'

/**
 * electron-builder 26.14+ builds blockmaps in JS via
 * require('@noble/hashes/blake2.js'). That package is ESM-only, so Node
 * older than 22.12 throws ERR_REQUIRE_ESM at the end of packaging.
 */
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    `Packaging needs Node >= 22.12 (have ${process.version}). ` +
      'electron-builder 26.15 require()s ESM @noble/hashes for blockmaps.'
  )
  process.exit(1)
}
