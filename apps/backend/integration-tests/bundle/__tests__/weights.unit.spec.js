/* global describe, it, expect */
const fs = require("node:fs")
const path = require("node:path")
const { measure, parseLog, weigher } = require("../weights")

const at = (line) => `2026-11-24T18:35:09.2698930Z ${line}`

const LOG = [
  at("[bundle] up to 8 files and 180 s of tests a bundle: 1 plain and 0 strict bundles"),
  at("[bundle] bundle-plain-001.spec.js (plain): a.spec.ts, b.spec.ts"),
  at("[bundle] a.spec.ts 30.4 s"),
  at("[bundle] b.spec.ts 9.6 s"),
  at("PASS integration-tests/.bundles/bundle-plain-001.spec.js (60 s)"),
  at("PASS integration-tests/http/alone.spec.ts (45.5 s)"),
  at("some other output 3 s"),
].join("\n")

describe("parseLog", () => {
  it("reads the files' seconds, the bundles and the files that ran alone", () => {
    const log = parseLog(LOG)
    expect([...log.files]).toEqual([
      ["a.spec.ts", 30.4],
      ["b.spec.ts", 9.6],
    ])
    expect(log.bundles.get("bundle-plain-001.spec.js")).toEqual({
      names: ["a.spec.ts", "b.spec.ts"],
      total: 60,
    })
    expect([...log.alone]).toEqual([["alone.spec.ts", 45.5]])
  })
})

describe("measure", () => {
  it("takes a bundle's own time as the boot and leaves it out of a lone file", () => {
    const { weights, boot } = measure([LOG])
    expect(boot).toBe(20)
    expect(weights).toEqual({ "a.spec.ts": 30, "alone.spec.ts": 26, "b.spec.ts": 10 })
  })

  it("gives a file seen in several logs its median, at least one second", () => {
    const other = LOG.replace("a.spec.ts 30.4 s", "a.spec.ts 50.4 s").replace(
      "b.spec.ts 9.6 s",
      "b.spec.ts 0.2 s"
    )
    expect(measure([LOG, other]).weights["a.spec.ts"]).toBe(40)
    expect(measure([other]).weights["b.spec.ts"]).toBe(1)
  })
})

describe("weigher", () => {
  it("gives an unmeasured file the median weight", () => {
    const weightOf = weigher({ "a.spec.ts": 5, "b.spec.ts": 9, "c.spec.ts": 100 })
    expect(weightOf("b.spec.ts")).toBe(9)
    expect(weightOf("new.spec.ts")).toBe(9)
  })
})

describe("weights.json", () => {
  it("weighs every HTTP spec file in whole seconds", () => {
    const weights = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "weights.json"), "utf8"))
    const values = Object.values(weights)
    expect(values.length).toBeGreaterThan(0)
    expect(values.every((seconds) => Number.isInteger(seconds) && seconds >= 1)).toBe(true)
    expect(Object.keys(weights)).toEqual(Object.keys(weights).sort())
  })
})
