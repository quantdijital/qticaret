/* global describe, it, expect, afterEach */
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { BUNDLES_DIR, bundleClass, retriable, retriableSource } = require("../classify")
const { bundleSize, prepareBundles } = require("../index")

describe("retriable", () => {
  it("names a generated bundle's class from its name alone", () => {
    expect(bundleClass(path.join(BUNDLES_DIR, "bundle-plain-004.spec.js"))).toBe("plain")
    expect(bundleClass(path.join(BUNDLES_DIR, "bundle-strict-001.spec.js"))).toBe("strict")
    expect(retriable(path.join(BUNDLES_DIR, "bundle-plain-004.spec.js"))).toBe(true)
    expect(retriable(path.join(BUNDLES_DIR, "bundle-strict-001.spec.js"))).toBe(false)
  })

  it("does not take a spec file elsewhere for a bundle", () => {
    expect(bundleClass("/repo/integration-tests/http/bundle-plain-001.spec.js")).toBeNull()
    expect(bundleClass(path.join(BUNDLES_DIR, "notes.spec.js"))).toBeNull()
  })

  it("never retries money, stock and races, nor files sending requests side by side", () => {
    expect(retriableSource("content.spec.ts", "await api.get()")).toBe(true)
    for (const name of ["payment-links.spec.ts", "stock-alerts.spec.ts", "order-race.spec.ts"]) {
      expect(retriableSource(name, "")).toBe(false)
    }
    expect(retriableSource("content.spec.ts", "await Promise.all([a(), b()])")).toBe(false)
  })

  it("reads a spec file from disk, and does not retry one it cannot read", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-classify-"))
    try {
      fs.writeFileSync(path.join(dir, "content.spec.ts"), "await api.get()")
      fs.writeFileSync(path.join(dir, "side.spec.ts"), "await Promise.allSettled([a()])")
      expect(retriable(path.join(dir, "content.spec.ts"))).toBe(true)
      expect(retriable(path.join(dir, "side.spec.ts"))).toBe(false)
      expect(retriable(path.join(dir, "missing.spec.ts"))).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("prepareBundles", () => {
  const dirs = []
  const scratch = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-bundles-"))
    dirs.push(dir)
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
  const runner = "medusaIntegrationTestRunner({\n  testSuite: () => {},\n})\n"

  it("is off unless QT_IT_BUNDLE asks for a size", () => {
    for (const value of [undefined, "", "0", "off"]) {
      expect(bundleSize(value)).toBeNull()
      expect(prepareBundles(value)).toBeNull()
    }
    expect(bundleSize("8")).toBe(8)
    expect(() => bundleSize("eight")).toThrow(/QT_IT_BUNDLE/)
  })

  it("leaves the folder holding exactly this plan's bundles, and matches them and the solo files", () => {
    const specDir = scratch()
    const outDir = path.join(scratch(), ".bundles")
    for (const name of ["a", "b", "c"]) {
      fs.writeFileSync(path.join(specDir, `${name}.spec.ts`), runner)
    }
    fs.writeFileSync(path.join(specDir, "env.spec.ts"), `process.env.X = "1"\n${runner}`)
    fs.writeFileSync(path.join(specDir, "helper.ts"), "export {}\n")
    fs.mkdirSync(outDir)
    fs.writeFileSync(path.join(outDir, "bundle-plain-009.spec.js"), "stale\n")
    const messages = []
    const quiet = { specDir, outDir, log: (message) => messages.push(message) }

    const first = prepareBundles("2", quiet)
    expect(fs.readdirSync(outDir).sort()).toEqual([
      "bundle-plain-001.spec.js",
      "bundle-plain-002.spec.js",
    ])
    expect(fs.readFileSync(path.join(outDir, "bundle-plain-002.spec.js"), "utf8")).toContain(
      '"c.spec.ts"'
    )
    expect(first.testMatch.slice(1)).toEqual(["**/integration-tests/http/env.spec.ts"])
    expect(first.testMatch[0]).toMatch(/\/bundle-\*\.spec\.js$/)
    expect(messages.at(-1)).toBe("2 files a bundle: 2 plain and 0 strict bundles, 1 files alone")

    const written = fs.statSync(path.join(outDir, "bundle-plain-001.spec.js")).mtimeMs
    const second = prepareBundles("2", quiet)
    expect(second.plan).toEqual(first.plan)
    // A file already as planned is not written again
    expect(fs.statSync(path.join(outDir, "bundle-plain-001.spec.js")).mtimeMs).toBe(written)
  })
})
