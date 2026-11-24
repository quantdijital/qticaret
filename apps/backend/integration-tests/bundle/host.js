/* global jest, expect, describe, it, beforeAll, afterAll */
// Runs the spec files of one generated bundle on a single Medusa boot
// (README.md in this folder). Each file's `medusaIntegrationTestRunner` call
// is collected instead of run; one real runner then hosts every file's
// testSuite in a describe named after the file.
//
// Within a file the runner snapshots the database before the file's first
// test (after its beforeAll hooks) and restores it before each later test.
// A bundle keeps that per file: before a file's hooks the database goes back
// to the state Medusa booted into, and the snapshot is taken again at the
// file's first test. Only public options are used: the runner's `dbUtils`
// and jest's own hooks.
const path = require("node:path")
const { withTemplate } = require("../template/runner")
const { forgetProcessCaches } = require("../../src/lib/cache/process-caches")

const HTTP_DIR = path.join(__dirname, "..", "http")
const TEST_UTILS = "@medusajs/test-utils"
const TIMEOUT = Symbol.for("TEST_TIMEOUT_SYMBOL")
const TEST_GLOBALS = ["it", "test", "fit", "xit", "xtest"]
const HOOK_GLOBALS = ["beforeAll", "beforeEach", "afterAll", "afterEach"]

const say = (message) => process.stderr.write(`[bundle] ${message}\n`)

// Loads each spec file and keeps what it gave its runner, and its jest.setTimeout
function collectSpecs(names) {
  const calls = []
  jest.mock(TEST_UTILS, () => {
    const actual = jest.requireActual(TEST_UTILS)
    return { ...actual, medusaIntegrationTestRunner: (options) => calls.push(options) }
  })
  return names.map((name) => {
    const before = calls.length
    globalThis[TIMEOUT] = undefined
    try {
      require(path.join(HTTP_DIR, name))
    } catch (error) {
      return { name, error }
    }
    const given = calls.slice(before)
    const keys = given.length === 1 ? Object.keys(given[0] ?? {}) : []
    if (given.length !== 1 || keys.some((key) => key !== "testSuite")) {
      const what =
        given.length === 1 ? `options ${keys.join(", ")}` : `${given.length} runner calls`
      return {
        name,
        error: new Error(`${name} is not bundle-safe (${what}): list it in bundle/solo.txt`),
      }
    }
    return { name, suite: given[0].testSuite, timeout: globalThis[TIMEOUT] }
  })
}

// While `register` runs, tests and hooks without a timeout of their own get
// `timeout`: the one the file set with jest.setTimeout, as it had alone
function withDefaultTimeout(timeout, register) {
  if (typeof timeout !== "number") {
    return register()
  }
  const saved = new Map([...TEST_GLOBALS, ...HOOK_GLOBALS].map((name) => [name, globalThis[name]]))
  for (const name of HOOK_GLOBALS) {
    const original = saved.get(name)
    globalThis[name] = (fn, ms) => original(fn, ms ?? timeout)
  }
  for (const name of TEST_GLOBALS) {
    const original = saved.get(name)
    if (typeof original !== "function") {
      continue
    }
    const wrapped = (title, fn, ms) => original(title, fn, ms ?? timeout)
    Object.assign(wrapped, original)
    if (typeof original.only === "function") {
      wrapped.only = (title, fn, ms) => original.only(title, fn, ms ?? timeout)
    }
    if (typeof original.each === "function") {
      wrapped.each = (...table) => {
        const bound = original.each(...table)
        return (title, fn, ms) => bound(title, fn, ms ?? timeout)
      }
    }
    globalThis[name] = wrapped
  }
  try {
    return register()
  } finally {
    for (const [name, original] of saved) {
      globalThis[name] = original
    }
  }
}

function realRunner() {
  const actual = jest.requireActual(TEST_UTILS).medusaIntegrationTestRunner
  const template = process.env.QT_IT_TEMPLATE
  return process.env.TEST_TYPE === "integration:http" && template
    ? withTemplate(actual, template)
    : actual
}

function runBundle(kind, names) {
  const bundle = path.basename(String(expect.getState().testPath ?? "bundle"))
  say(`${bundle} (${kind}): ${names.join(", ")}`)
  const specs = collectSpecs(names)
  const timeouts = specs.map((spec) => spec.timeout).filter((ms) => typeof ms === "number")
  // Medusa's boot, the runner's own hooks and anything not given a timeout
  // above wait as long as the slowest file allows
  jest.setTimeout(Math.max(120 * 1000, ...timeouts))

  const state = { context: null, snapshotDue: false, runnerHookSeen: false }
  // The runner's beforeEach restores the snapshot before each test; the
  // first one a file runs takes that file's snapshot first
  const registerBeforeEach = globalThis.beforeEach
  globalThis.beforeEach = (fn, ms) => {
    globalThis.beforeEach = registerBeforeEach
    state.runnerHookSeen = true
    return registerBeforeEach(async function snapshotFirst() {
      if (state.snapshotDue) {
        state.snapshotDue = false
        // Also tells the runner to skip its restore before this test
        await state.context.dbUtils.snapshot()
      }
      return fn.call(this)
    }, ms)
  }
  try {
    realRunner()({ testSuite: (context) => hostSuites(context, state, specs, bundle) })
  } finally {
    globalThis.beforeEach = registerBeforeEach
  }
}

function hostSuites(context, state, specs, bundle) {
  state.context = context
  const files = specs.map((spec) => spec.name).join(", ")
  const booted = `${context.dbConfig.dbName}-booted`
  beforeAll(async () => {
    if (!state.runnerHookSeen) {
      throw new Error(
        `${bundle}: Medusa's runner registered no beforeEach; run with QT_IT_BUNDLE unset`
      )
    }
    if (!context.getContainer()) {
      throw new Error(`${bundle}: Medusa did not start, so every file of it failed: ${files}`)
    }
    await context.dbUtils.snapshot({ templateName: booted })
  })
  afterAll(async () => {
    await context.dbUtils.dropTemplate(booted)
  })
  specs.forEach((spec, index) => {
    describe(spec.name, () => {
      let started = 0
      beforeAll(async () => {
        started = Date.now()
        if (index > 0) {
          await context.dbUtils.restore({ templateName: booted })
          // What the app holds in process (caches, provider clients and their
          // circuit breakers, counters) goes with the database, as in a fresh
          // process (src/lib/cache/process-caches.ts)
          forgetProcessCaches()
        }
        state.snapshotDue = true
      })
      if (spec.error) {
        it("loads", () => {
          throw spec.error
        })
        return
      }
      withDefaultTimeout(spec.timeout, () => spec.suite(context))
      // Runs after the file's own afterAll hooks (jest-circus keeps their order)
      afterAll(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
        say(`${spec.name} ${((Date.now() - started) / 1000).toFixed(1)} s`)
      })
    })
  })
}

module.exports = { runBundle }
