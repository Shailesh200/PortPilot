'use strict'

const fs = require('fs')

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
if (!pkg.build || !pkg.build.mas) {
  console.error('package.json is missing build.mas')
  process.exit(1)
}

const short = process.env.MAS_SHORT_VERSION || pkg.version
const raw = process.env.MAS_BUNDLE_VERSION || process.env.GITHUB_RUN_NUMBER
const n = Number(raw)
if (!Number.isFinite(n) || n < 0) {
  console.error('MAS_BUNDLE_VERSION must be a number (got %s)', raw)
  process.exit(1)
}
const build = String(Math.floor(n) + 1000)

pkg.build.mas.bundleShortVersion = String(short)
pkg.build.mas.bundleVersion = String(build)
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log(`Stamped MAS CFBundleShortVersionString=${short} CFBundleVersion=${build}`)
