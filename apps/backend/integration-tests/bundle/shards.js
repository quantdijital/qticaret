// Spreads the test files of a run over its --shard jobs by expected seconds
// (sequencer.js, README.md in this folder): every job plans alike from the
// same checkout and keeps its own part.
const fs = require("node:fs")
const path = require("node:path")
const { bundleClass } = require("./classify")
const { bundleSeconds } = require("./plan")
const { BOOT_SECONDS, loadWeights, weigher } = require("./weights")

const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
const heaviestFirst = (a, b) => b.seconds - a.seconds || byKey(a, b)

/**
 * `items` (`{ key, seconds }`, keys unique) in `count` parts of about equal
 * seconds: heaviest first, each to the lightest part so far (the first of
 * equals). The same items in any order give the same parts.
 */
function assignShards(items, count) {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`shard count must be a whole number from 1 up, not ${String(count)}`)
  }
  const parts = Array.from({ length: count }, () => ({ seconds: 0, items: [] }))
  for (const item of [...items].sort(heaviestFirst)) {
    let lightest = parts[0]
    for (const part of parts) {
      if (part.seconds < lightest.seconds) {
        lightest = part
      }
    }
    lightest.items.push(item)
    lightest.seconds += item.seconds
  }
  return parts
}

/**
 * The expected seconds of a test file jest runs: a bundle's are written in
 * it; a spec file run alone gets its weight and a boot.
 */
function testSeconds(testPath, weightOf = weigher(loadWeights())) {
  if (bundleClass(testPath)) {
    let text = ""
    try {
      text = fs.readFileSync(testPath, "utf8")
    } catch {
      // Not there: weighed as an unknown file below
    }
    const seconds = bundleSeconds(text)
    if (seconds !== null) {
      return seconds
    }
  }
  return BOOT_SECONDS + weightOf(path.basename(testPath))
}

module.exports = { assignShards, heaviestFirst, testSeconds }
