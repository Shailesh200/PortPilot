'use strict'

const verifyAsar = require('./verify-asar.cjs')
const sanitizeMasPlist = require('./mas-sanitize-plist.cjs')

module.exports = async function afterPack(context) {
  await verifyAsar(context)
  await sanitizeMasPlist(context)
}
