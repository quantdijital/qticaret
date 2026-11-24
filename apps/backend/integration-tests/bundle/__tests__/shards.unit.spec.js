/* global describe, it, expect */
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { BUNDLES_DIR } = require("../classify")
const { bundleSource } = require("../plan")
const { assignShards, testSeconds } = require("../shards")
const { BOOT_SECONDS } = require("../weights")
const WeightedSequencer = require("../sequencer")

// A spread of bundle-like seconds: a few heavy ones, many light ones
const ITEMS = Array.from({ length: 60 }, (_, index) => ({
  key: `integration-tests/.bundles/bundle-plain-${String(index).padStart(3, "0")}.spec.js`,
  seconds: index < 3 ? 300 - index * 40 : 30 + ((index * 37) % 150),
}))

const sum = (items) => items.reduce((total, item) => total + item.seconds, 0)

describe("assignShards", () => {
  it("gives the same parts whatever order the items come in", () => {
    const once = assignShards(ITEMS, 8)
    const again = assignShards([...ITEMS].reverse(), 8)
    expect(again.map((part) => part.items.map((item) => item.key))).toEqual(
      once.map((part) => part.items.map((item) => item.key))
    )
  })

  it("puts each item in exactly one part", () => {
    const keys = assignShards(ITEMS, 7).flatMap((part) => part.items.map((item) => item.key))
    expect(keys.sort()).toEqual(ITEMS.map((item) => item.key).sort())
  })

  it("keeps the parts within one light item of each other", () => {
    for (const count of [6, 7, 8]) {
      const totals = assignShards(ITEMS, count).map((part) => sum(part.items))
      expect(totals.reduce((a, b) => a + b, 0)).toBe(sum(ITEMS))
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(60)
    }
  })

  it("refuses a count that is not a whole number from 1 up", () => {
    expect(() => assignShards(ITEMS, 0)).toThrow(/whole number/)
  })
})

describe("testSeconds", () => {
  it("reads a bundle's seconds from it and weighs a lone file with a boot", () => {
    const bundle = path.join(BUNDLES_DIR, "bundle-strict-999.spec.js")
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-shards-"))
    const fake = path.join(dir, path.basename(BUNDLES_DIR), path.basename(bundle))
    fs.mkdirSync(path.dirname(fake))
    fs.writeFileSync(fake, bundleSource({ kind: "strict", specs: ["a.spec.ts"], seconds: 77 }))
    try {
      expect(testSeconds(fake, () => 5)).toBe(77)
      expect(testSeconds("/x/integration-tests/http/a.spec.ts", () => 5)).toBe(BOOT_SECONDS + 5)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("WeightedSequencer", () => {
  const rootDir = "/repo/apps/backend"
  const tests = ["alpha", "beta", "gamma", "delta", "epsilon"].map((name) => ({
    path: path.join(rootDir, "integration-tests", "http", `${name}.spec.ts`),
    context: { config: { rootDir } },
  }))

  it("gives every test file to exactly one shard, alike on every job", () => {
    const sequencer = new WeightedSequencer()
    const parts = [1, 2, 3].map((shardIndex) =>
      sequencer.shard([...tests].reverse(), { shardIndex, shardCount: 3 })
    )
    const again = new WeightedSequencer().shard(tests, { shardIndex: 2, shardCount: 3 })
    expect(again).toEqual(parts[1])
    expect(
      parts
        .flat()
        .map((test) => test.path)
        .sort()
    ).toEqual(tests.map((test) => test.path).sort())
  })

  it("runs the heaviest file first", () => {
    const sorted = new WeightedSequencer().sort([...tests])
    const seconds = sorted.map((test) => testSeconds(test.path))
    expect(seconds).toEqual([...seconds].sort((a, b) => b - a))
  })
})
