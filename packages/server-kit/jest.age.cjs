// Jest only (moduleNameMapper): age-encryption is ES modules only, and a
// Jest run with --experimental-vm-modules (the Medusa apps') refuses to
// require it. Node itself loads it with require(esm), outside Jest's module
// registry; the code under test is the same. The apps' runtime never loads
// this file.
const { createRequire } = process.getBuiltinModule("node:module")

module.exports = createRequire(__filename)("age-encryption")
