// How long each HTTP spec file takes, measured on CI (weights.json in this
// folder): the planner fills bundles by these seconds and the sequencer
// spreads bundles over --shard jobs by them (README.md in this folder).
//
// Regenerated from the logs of a CI run's HTTP jobs, with QT_IT_BUNDLE on
// (README.md, "Shards by seconds"): the whole run's log at once,
//   gh run view <run id> --log > run.log
//   node integration-tests/bundle/weights.js run.log
// or each job's (gh api repos/<owner>/<repo>/actions/jobs/<job id>/logs).
// Several runs' logs give each file its median.
// host.js writes a line for each bundled file ("[bundle] <file> <seconds> s");
// a file that runs alone is read from jest's "PASS <path> (<seconds> s)".
const fs = require("node:fs")
const path = require("node:path")

const WEIGHTS_FILE = path.join(__dirname, "weights.json")
// A bundle's own time besides its files: Medusa's boot on the template
// database, loading the files and the runner's hooks (median of a CI run's
// bundles, adr/0081 Ek). A file run alone pays it too.
const BOOT_SECONDS = 17

// A job's own log starts each line with its time; `gh run view --log` puts
// the job's and the step's names before it, a tab after each
const TIMESTAMP = /^(?:[^\t]*\t[^\t]*\t)?\S+Z /
const FILE_LINE = /^\[bundle\] ([\w.-]+\.spec\.[jt]s) ([\d.]+) s$/
const BUNDLE_LINE = /^\[bundle\] (bundle-[\w-]+\.spec\.js) \((?:plain|strict)\): (.+)$/
const RESULT_LINE = /^(?:PASS|FAIL) integration-tests\/(http|\.bundles)\/([\w.-]+) \(([\d.]+) s\)/

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** What one job's log says: each bundled file's, each bundle's and each lone file's seconds. */
function parseLog(text) {
  const files = new Map()
  const bundles = new Map()
  const alone = new Map()
  for (const raw of text.split("\n")) {
    const line = raw.replace(TIMESTAMP, "").trimEnd()
    let match = FILE_LINE.exec(line)
    if (match) {
      files.set(match[1], Number(match[2]))
      continue
    }
    match = BUNDLE_LINE.exec(line)
    if (match) {
      const entry = bundles.get(match[1]) ?? {}
      bundles.set(match[1], { ...entry, names: match[2].split(", ") })
      continue
    }
    match = RESULT_LINE.exec(line)
    if (match && match[1] === "http") {
      alone.set(match[2], Number(match[3]))
    } else if (match) {
      const entry = bundles.get(match[2]) ?? {}
      bundles.set(match[2], { ...entry, total: Number(match[3]) })
    }
  }
  return { files, bundles, alone }
}

/**
 * Each spec file's seconds without the boot (a lone file's measured time less
 * the median bundle's own time), whole seconds, at least 1, in name order;
 * and that measured boot. A file seen in several logs gets its median.
 */
function measure(texts) {
  const seen = new Map()
  const boots = []
  const note = (name, seconds) => seen.set(name, [...(seen.get(name) ?? []), seconds])
  const parsed = texts.map(parseLog)
  for (const log of parsed) {
    for (const [name, seconds] of log.files) {
      note(name, seconds)
    }
    for (const bundle of log.bundles.values()) {
      if (bundle.names && typeof bundle.total === "number") {
        const timed = bundle.names.filter((name) => log.files.has(name))
        if (timed.length === bundle.names.length) {
          const files = timed.reduce((sum, name) => sum + log.files.get(name), 0)
          boots.push(Math.max(0, bundle.total - files))
        }
      }
    }
  }
  const boot = boots.length > 0 ? median(boots) : BOOT_SECONDS
  for (const log of parsed) {
    for (const [name, seconds] of log.alone) {
      note(name, seconds - boot)
    }
  }
  const weights = {}
  for (const name of [...seen.keys()].sort()) {
    weights[name] = Math.max(1, Math.round(median(seen.get(name))))
  }
  return { weights, boot, bundles: boots.length }
}

/**
 * A function giving a spec file's seconds without the boot: its measured
 * weight, or the median weight for a file not measured yet (a new one).
 */
function weigher(weights) {
  const values = Object.values(weights)
  const fallback = values.length > 0 ? median(values) : 1
  return (name) => (Object.hasOwn(weights, name) ? weights[name] : fallback)
}

function loadWeights(file = WEIGHTS_FILE) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}
}

if (require.main === module) {
  const logs = process.argv.slice(2)
  if (logs.length === 0) {
    process.stderr.write("usage: node weights.js <CI log of an HTTP job>...\n")
    process.exit(2)
  }
  const { weights, boot, bundles } = measure(logs.map((log) => fs.readFileSync(log, "utf8")))
  fs.writeFileSync(WEIGHTS_FILE, `${JSON.stringify(weights, null, 2)}\n`)
  const total = Object.values(weights).reduce((sum, seconds) => sum + seconds, 0)
  process.stdout.write(
    `${Object.keys(weights).length} files, ${total} s of tests; a bundle's own time ` +
      `${boot.toFixed(1)} s (median of ${bundles}; BOOT_SECONDS is ${BOOT_SECONDS})\n`
  )
}

module.exports = { BOOT_SECONDS, WEIGHTS_FILE, loadWeights, measure, parseLog, weigher }
