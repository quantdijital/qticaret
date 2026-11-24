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

function chunk(names, size, kind) {
  const bundles = []
  for (let start = 0; start < names.length; start += size) {
    const number = String(bundles.length + 1).padStart(3, "0")
    bundles.push({
      file: `bundle-${kind}-${number}.spec.js`,
      kind,
      specs: names.slice(start, start + size),
    })
  }
  return bundles
}

/**
 * The bundles of `size` files each, in name order: plain files (a failed test
 * is tried again on CI) and strict ones (never) apart, so that a bundle's
 * class is its files' class. `specs` are `{ name, source }`; `soloList` is
 * the parsed solo.txt.
 */
function planBundles(specs, size, soloList = new Map()) {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`bundle size must be a whole number from 1 up, not ${String(size)}`)
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
    bundles: [...chunk(plain, size, "plain"), ...chunk(strict, size, "strict")],
    solo,
    unknownSolo: [...soloList.keys()].filter((name) => !known.has(name)),
  }
}

/** A generated bundle file's text: its spec files, loaded by host.js. */
function bundleSource(bundle) {
  const names = bundle.specs.map((name) => `  ${JSON.stringify(name)},`).join("\n")
  return [
    "// Generated from integration-tests/http by integration-tests/bundle (QT_IT_BUNDLE);",
    "// not committed, rewritten on every run. See bundle/README.md.",
    `require("../bundle/host").runBundle(${JSON.stringify(bundle.kind)}, [`,
    names,
    "])",
    "",
  ].join("\n")
}

module.exports = { bundleSource, parseSoloList, planBundles, soloReasonOf }
