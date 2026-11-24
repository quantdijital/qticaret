// Plans the bundles of the HTTP integration suite (README.md in this folder):
// which spec files share one Medusa boot, in which bundle, and which run
// alone. Pure functions of the files' names and sources: every CI shard
// plans the same bundles from the same checkout.
const { retriableSource } = require("./classify")

// What makes a spec file unsafe to share a module registry and a process
// with others; the first rule that matches is its reason to run alone
const RUNNER_CALL = /^medusaIntegrationTestRunner\(\{/gm
const MODULE_MOCKS =
  /\bjest\.(mock|doMock|unstable_mockModule|resetModules|isolateModules|enableAutomock)\(/
// Written at module level (column 0): it would hold for every file of the bundle
const TOP_LEVEL_ENV =
  /^(process\.env(\.\w+|\[[^\]]+\])\s*(=(?!=)|\?\?=|\|\|=|&&=)|delete process\.env|Object\.assign\(\s*process\.env)/m
const TOP_LEVEL_FAKE_TIMERS = /^(?=\S).*\bjest\.useFakeTimers\(/m
// A bundle restores spies after each file: one made at module level would be
// gone before its own file ran
const TOP_LEVEL_SPIES = /^(?=\S).*\bjest\.(spyOn|replaceProperty)\(/m
// Hooks and tests outside the runner would run around the whole bundle
const TOP_LEVEL_JEST = /^(beforeAll|afterAll|beforeEach|afterEach|describe|it|test)(\.\w+)?\(/m
const STEP_OR_WORKFLOW_ID = /\bcreate(Step|Workflow)\(\s*["'`]([^"'`]+)["'`]/g

/** The runner's own options (besides `testSuite`) given at its one call, or a reason. */
function runnerProblem(source) {
  const calls = source.match(RUNNER_CALL) ?? []
  if (calls.length !== 1) {
    return `calls medusaIntegrationTestRunner({ at module level ${calls.length} times, not once`
  }
  const lines = source.slice(source.search(RUNNER_CALL)).split("\n").slice(1)
  const extra = []
  for (const line of lines) {
    if (/^\S/.test(line)) {
      break
    }
    // Prettier puts the call's own keys two spaces in
    const key = /^ {2}(\.\.\.|[A-Za-z_$][\w$]*)/.exec(line)?.[1]
    if (key && key !== "testSuite") {
      extra.push(key)
    }
  }
  return extra.length > 0
    ? `gives medusaIntegrationTestRunner options besides testSuite (${extra.join(", ")})`
    : null
}

/** Why a spec file runs alone, read from its source; null when it may share a boot. */
function soloReasonOf(source) {
  const runner = runnerProblem(source)
  if (runner) {
    return runner
  }
  if (MODULE_MOCKS.test(source)) {
    return "mocks modules (jest.mock and kin)"
  }
  if (TOP_LEVEL_ENV.test(source)) {
    return "writes process.env at module level"
  }
  if (TOP_LEVEL_FAKE_TIMERS.test(source)) {
    return "turns fake timers on at module level"
  }
  if (TOP_LEVEL_SPIES.test(source)) {
    return "spies at module level"
  }
  if (TOP_LEVEL_JEST.test(source)) {
    return "has hooks or tests outside the runner"
  }
  return null
}

/** solo.txt: a file name a line, `#` and the reason after it; blank lines and comments skipped. */
function parseSoloList(text) {
  const entries = new Map()
  for (const raw of text.split("\n")) {
    const hash = raw.indexOf("#")
    const name = (hash === -1 ? raw : raw.slice(0, hash)).trim()
    if (name) {
      const reason = hash === -1 ? "" : raw.slice(hash + 1).trim()
      entries.set(name, `listed in solo.txt${reason ? `: ${reason}` : ""}`)
    }
  }
  return entries
}

/** Step and workflow ids two spec files both define: such files would clash in one registry. */
function sharedIds(specs) {
  const owners = new Map()
  for (const spec of specs) {
    for (const match of spec.source.matchAll(STEP_OR_WORKFLOW_ID)) {
      const files = owners.get(match[2]) ?? new Set()
      files.add(spec.name)
      owners.set(match[2], files)
    }
  }
  const clashing = new Map()
  for (const [id, files] of owners) {
    if (files.size > 1) {
      for (const name of files) {
        clashing.set(name, id)
      }
    }
  }
  return clashing
}

/**
 * Cuts `names` (in name order) into bundles of at most `size` files. With
 * `timing`, a bundle is also closed before a file would take it past
 * `timing.target` seconds, so a heavy file starts a bundle of its own; each
 * bundle then carries its expected seconds (its files' and one boot).
 */
function pack(names, size, kind, timing) {
  const groups = []
  let current = []
  let seconds = 0
  for (const name of names) {
    const weight = timing ? timing.weightOf(name) : 0
    const full = current.length >= size || (timing && seconds + weight > timing.target)
    if (current.length > 0 && full) {
      groups.push({ specs: current, seconds })
      current = []
      seconds = 0
    }
    current.push(name)
    seconds += weight
  }
  if (current.length > 0) {
    groups.push({ specs: current, seconds })
  }
  return groups.map((group, index) => ({
    file: `bundle-${kind}-${String(index + 1).padStart(3, "0")}.spec.js`,
    kind,
    specs: group.specs,
    ...(timing ? { seconds: Math.round(timing.boot + group.seconds) } : {}),
  }))
}

/**
 * The bundles, in name order: plain files (a failed test is tried again on
 * CI) and strict ones (never) apart, so that a bundle's class is its files'
 * class. `specs` are `{ name, source }`; `soloList` is the parsed solo.txt.
 * A bundle holds at most `size` files and, given `timing` (`{ weightOf(name),
 * target, boot }`, seconds: weights.js), about `target` seconds of tests.
 */
function planBundles(specs, size, soloList = new Map(), timing = null) {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`bundle size must be a whole number from 1 up, not ${String(size)}`)
  }
  if (timing && !(timing.target > 0)) {
    throw new Error(`a bundle's target must be some seconds, not ${String(timing.target)}`)
  }
  const sorted = [...specs].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const clashing = sharedIds(sorted)
  const solo = []
  const plain = []
  const strict = []
  for (const spec of sorted) {
    const reason =
      soloList.get(spec.name) ??
      soloReasonOf(spec.source) ??
      (clashing.has(spec.name)
        ? `defines step or workflow "${clashing.get(spec.name)}" another file defines too`
        : null)
    if (reason) {
      solo.push({ name: spec.name, reason })
    } else if (retriableSource(spec.name, spec.source)) {
      plain.push(spec.name)
    } else {
      strict.push(spec.name)
    }
  }
  const known = new Set(sorted.map((spec) => spec.name))
  return {
    bundles: [...pack(plain, size, "plain", timing), ...pack(strict, size, "strict", timing)],
    solo,
    unknownSolo: [...soloList.keys()].filter((name) => !known.has(name)),
  }
}

// The expected seconds a bundle file carries, for the sequencer (sequencer.js)
const SECONDS_LINE = /^\/\/ Expected: (\d+) s$/m

/** A generated bundle file's text: its spec files, loaded by host.js. */
function bundleSource(bundle) {
  const names = bundle.specs.map((name) => `  ${JSON.stringify(name)},`).join("\n")
  return [
    "// Generated from integration-tests/http by integration-tests/bundle (QT_IT_BUNDLE);",
    "// not committed, rewritten on every run. See bundle/README.md.",
    ...(typeof bundle.seconds === "number" ? [`// Expected: ${bundle.seconds} s`] : []),
    `require("../bundle/host").runBundle(${JSON.stringify(bundle.kind)}, [`,
    names,
    "])",
    "",
  ].join("\n")
}

/** The expected seconds written into a bundle file's text; null when it has none. */
function bundleSeconds(text) {
  const match = SECONDS_LINE.exec(text)
  return match ? Number(match[1]) : null
}

module.exports = { bundleSeconds, bundleSource, parseSoloList, planBundles, soloReasonOf }
