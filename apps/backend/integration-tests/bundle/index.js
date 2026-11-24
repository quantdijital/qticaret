// Called from jest.config.js (TEST_TYPE=integration:http): with QT_IT_BUNDLE
// set, writes the bundles of this run and returns the testMatch that runs
// them and the files that run alone. Synchronous, as jest's config is.
// README.md in this folder.
const fs = require("node:fs")
const path = require("node:path")
const { BUNDLES_DIR } = require("./classify")
const { bundleSource, parseSoloList, planBundles } = require("./plan")

const HTTP_DIR = path.join(__dirname, "..", "http")
const SOLO_LIST = path.join(__dirname, "solo.txt")
const SPEC_FILE = /\.spec\.[jt]s$/

/** The bundle size QT_IT_BUNDLE asks for; null when bundling is off. */
function bundleSize(value) {
  const text = String(value ?? "").trim()
  if (text === "" || text === "0" || text === "off") {
    return null
  }
  const size = Number(text)
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`QT_IT_BUNDLE must be a whole number of files a bundle (or off), not "${text}"`)
  }
  return size
}

function readSpecs(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => SPEC_FILE.test(name))
    .map((name) => ({ name, source: fs.readFileSync(path.join(dir, name), "utf8") }))
}

/**
 * Leaves `dir` holding exactly `files` (name → text). A file already as
 * planned is left alone and a new one is renamed into place, so a run
 * started at the same time from the same checkout reads whole files.
 */
function syncDirectory(dir, files) {
  fs.mkdirSync(dir, { recursive: true })
  for (const name of fs.readdirSync(dir)) {
    if (!files.has(name)) {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }
  for (const [name, text] of files) {
    const target = path.join(dir, name)
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null
    if (current !== text) {
      const temporary = path.join(dir, `.${name}.${process.pid}.tmp`)
      fs.writeFileSync(temporary, text)
      fs.renameSync(temporary, target)
    }
  }
}

function prepareBundles(value, { specDir = HTTP_DIR, outDir = BUNDLES_DIR, log } = {}) {
  const size = bundleSize(value)
  if (size === null) {
    return null
  }
  const say = log ?? ((message) => process.stderr.write(`[bundle] ${message}\n`))
  const soloList = fs.existsSync(SOLO_LIST)
    ? parseSoloList(fs.readFileSync(SOLO_LIST, "utf8"))
    : new Map()
  const plan = planBundles(readSpecs(specDir), size, soloList)
  for (const name of plan.unknownSolo) {
    say(`solo.txt names ${name}, which is not in integration-tests/http: remove the line`)
  }
  syncDirectory(outDir, new Map(plan.bundles.map((bundle) => [bundle.file, bundleSource(bundle)])))
  const count = (kind) => plan.bundles.filter((bundle) => bundle.kind === kind).length
  say(
    `${size} files a bundle: ${count("plain")} plain and ${count("strict")} strict bundles, ` +
      `${plan.solo.length} files alone`
  )
  const relative = path.relative(path.join(__dirname, ".."), outDir).split(path.sep).join("/")
  return {
    plan,
    testMatch: [
      `**/integration-tests/${relative}/bundle-*.spec.js`,
      ...plan.solo.map((spec) => `**/integration-tests/http/${spec.name}`),
    ],
  }
}

module.exports = { bundleSize, prepareBundles, syncDirectory }
