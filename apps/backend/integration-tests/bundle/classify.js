// Which HTTP spec files are tried a second time on CI (adr/0081), in one
// place: plain-failures.js asks it of the file jest runs, and the bundle
// planner (plan.js) asks it of every spec file to put it in a plain or a
// strict bundle.
//
// Not retried where failing now and then IS the finding: a file that tests a
// race, an idempotent delivery, stock or money moved by two requests at once.
// A second try there would turn a one-in-five double order into one in
// twenty-five and call the rest green. Such a file is known by its name
// (payments, stock, refunds, notifications) or by sending requests side by
// side (`Promise.all`); a file that cannot be read is not retried either.
const fs = require("node:fs")
const path = require("node:path")

const MONEY_OR_STOCK =
  /(race|idempot|notification|webhook|callback|stock|gift-card|refund|payment|checkout|plan-limits)/
const SIDE_BY_SIDE = /Promise\.all(Settled)?\(/

// Where the generated bundles are written, and how each is named
// (bundle-plain-007.spec.js): its class is in its name
const BUNDLES_DIR = path.join(__dirname, "..", ".bundles")
const BUNDLE_NAME = /^bundle-(plain|strict)-\d+\.spec\.js$/

/** A spec file by its name and its source text. */
function retriableSource(name, source) {
  return !MONEY_OR_STOCK.test(name) && !SIDE_BY_SIDE.test(source)
}

/** "plain" or "strict" for a generated bundle file, else null. */
function bundleClass(testPath) {
  if (path.basename(path.dirname(testPath)) !== path.basename(BUNDLES_DIR)) {
    return null
  }
  const match = BUNDLE_NAME.exec(path.basename(testPath))
  return match ? match[1] : null
}

/** Whether the test file jest runs may try a failed test once more. */
function retriable(testPath) {
  const kind = bundleClass(testPath)
  if (kind) {
    // A strict bundle holds only files that are never retried
    return kind === "plain"
  }
  try {
    return retriableSource(path.basename(testPath), fs.readFileSync(testPath, "utf8"))
  } catch {
    return false
  }
}

module.exports = { BUNDLES_DIR, bundleClass, retriable, retriableSource }
