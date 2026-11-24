/* global describe, it, expect */
const { bundleSeconds, bundleSource, parseSoloList, planBundles, soloReasonOf } = require("../plan")

const suite = (body = "") =>
  [
    'import { medusaIntegrationTestRunner } from "@medusajs/test-utils"',
    "",
    "jest.setTimeout(120 * 1000)",
    "",
    "medusaIntegrationTestRunner({",
    "  testSuite: ({ api }) => {",
    '    it("works", async () => {',
    `      ${body}`,
    "    })",
    "  },",
    "})",
    "",
  ].join("\n")

const spec = (name, source = suite()) => ({ name, source })

describe("soloReasonOf", () => {
  it("lets a file that gives the runner testSuite alone share a boot", () => {
    expect(soloReasonOf(suite('await api.get("/health")'))).toBeNull()
  })

  it("sets apart a file that gives the runner other options", () => {
    const source = suite().replace("  },\n})", '  },\n  env: { FLAG: "on" },\n})')
    expect(soloReasonOf(source)).toMatch(/options besides testSuite \(env\)/)
    const first = suite().replace("medusaIntegrationTestRunner({\n", "$&  ...shared,\n")
    expect(soloReasonOf(first)).toMatch(/\(\.\.\.\)/)
  })

  it("sets apart a file that calls the runner other than once at module level", () => {
    expect(soloReasonOf("medusaIntegrationTestRunner(options)\n")).toMatch(/0 times/)
    expect(soloReasonOf(suite() + suite())).toMatch(/2 times/)
  })

  it("sets apart module mocks anywhere in the file", () => {
    expect(soloReasonOf(`jest.mock("../../src/lib/x")\n${suite()}`)).toMatch(/mocks modules/)
    expect(soloReasonOf(suite("jest.isolateModules(() => {})"))).toMatch(/mocks modules/)
  })

  it("sets apart process.env written at module level, not inside a test", () => {
    expect(soloReasonOf(`process.env["FLAG"] = "on"\n${suite()}`)).toMatch(/process\.env/)
    expect(soloReasonOf(`process.env.FLAG ??= "on"\n${suite()}`)).toMatch(/process\.env/)
    expect(soloReasonOf(`Object.assign(process.env, { A: "1" })\n${suite()}`)).toMatch(
      /process\.env/
    )
    expect(soloReasonOf(`delete process.env.FLAG\n${suite()}`)).toMatch(/process\.env/)
    expect(soloReasonOf(suite('process.env["FLAG"] = "on"'))).toBeNull()
    expect(soloReasonOf(`process.env.FLAG === "on"\n${suite()}`)).toBeNull()
  })

  it("sets apart fake timers, spies, hooks and tests at module level", () => {
    expect(soloReasonOf(`jest.useFakeTimers()\n${suite()}`)).toMatch(/fake timers/)
    expect(soloReasonOf(`const spy = jest.spyOn(Date, "now")\n${suite()}`)).toMatch(/spies/)
    expect(soloReasonOf(`afterAll(() => {})\n${suite()}`)).toMatch(/outside the runner/)
    expect(soloReasonOf(`describe.skip("x", () => {})\n${suite()}`)).toMatch(/outside the runner/)
    expect(soloReasonOf(suite("jest.useFakeTimers()"))).toBeNull()
    expect(soloReasonOf(suite('jest.spyOn(Date, "now")'))).toBeNull()
  })
})

describe("parseSoloList", () => {
  it("reads a file name a line with its reason, skipping comments and blanks", () => {
    const list = parseSoloList(
      "# header\n\nslow.spec.ts # fills the settings cache\nbare.spec.ts\n  # example.spec.ts # no\n"
    )
    expect([...list]).toEqual([
      ["slow.spec.ts", "listed in solo.txt: fills the settings cache"],
      ["bare.spec.ts", "listed in solo.txt"],
    ])
  })
})

describe("planBundles", () => {
  const names = ["e", "a", "payment-x", "c", "b", "d", "f"].map((n) => `${n}.spec.ts`)

  it("bundles in name order, the same whatever order the files come in", () => {
    const specs = names.map((name) => spec(name))
    const once = planBundles(specs, 2)
    const again = planBundles([...specs].reverse(), 2)
    expect(again).toEqual(once)
    expect(once.bundles.map((bundle) => [bundle.file, bundle.specs])).toEqual([
      ["bundle-plain-001.spec.js", ["a.spec.ts", "b.spec.ts"]],
      ["bundle-plain-002.spec.js", ["c.spec.ts", "d.spec.ts"]],
      ["bundle-plain-003.spec.js", ["e.spec.ts", "f.spec.ts"]],
      ["bundle-strict-001.spec.js", ["payment-x.spec.ts"]],
    ])
  })

  it("keeps files never retried (by name or by Promise.all) in strict bundles", () => {
    const plan = planBundles(
      [
        spec("a.spec.ts"),
        spec("refund-flow.spec.ts"),
        spec("b.spec.ts", suite("await Promise.all([one(), two()])")),
        spec("c.spec.ts", suite("await Promise.allSettled([one()])")),
      ],
      8
    )
    expect(plan.bundles.map((bundle) => [bundle.kind, bundle.specs])).toEqual([
      ["plain", ["a.spec.ts"]],
      ["strict", ["b.spec.ts", "c.spec.ts", "refund-flow.spec.ts"]],
    ])
  })

  it("leaves out of every bundle the files that run alone, with why", () => {
    const plan = planBundles(
      [
        spec("a.spec.ts"),
        spec("env.spec.ts", `process.env.X = "1"\n${suite()}`),
        spec("listed.spec.ts"),
      ],
      8,
      parseSoloList("listed.spec.ts # shares a cache\ngone.spec.ts # deleted since\n")
    )
    expect(plan.bundles.flatMap((bundle) => bundle.specs)).toEqual(["a.spec.ts"])
    expect(plan.solo).toEqual([
      { name: "env.spec.ts", reason: "writes process.env at module level" },
      { name: "listed.spec.ts", reason: "listed in solo.txt: shares a cache" },
    ])
    expect(plan.unknownSolo).toEqual(["gone.spec.ts"])
  })

  it("sets apart files that define the same step or workflow id", () => {
    const step = 'const failing = createStep("test-fail", () => {})\n'
    const plan = planBundles(
      [spec("a.spec.ts", step + suite()), spec("b.spec.ts", step + suite()), spec("c.spec.ts")],
      8
    )
    expect(plan.solo.map((entry) => entry.name)).toEqual(["a.spec.ts", "b.spec.ts"])
    expect(plan.solo[0].reason).toMatch(/"test-fail"/)
  })

  it("fills bundles by seconds up to the target, a heavy file in a bundle of its own", () => {
    const seconds = { "a.spec.ts": 40, "b.spec.ts": 50, "c.spec.ts": 300, "d.spec.ts": 20 }
    const timing = { weightOf: (name) => seconds[name] ?? 10, target: 100, boot: 17 }
    const specs = ["a", "b", "c", "d", "e", "f"].map((n) => spec(`${n}.spec.ts`))
    const plan = planBundles(specs, 8, new Map(), timing)
    expect(plan.bundles.map((bundle) => [bundle.specs, bundle.seconds])).toEqual([
      [["a.spec.ts", "b.spec.ts"], 107],
      [["c.spec.ts"], 317],
      [["d.spec.ts", "e.spec.ts", "f.spec.ts"], 57],
    ])
    expect(planBundles([...specs].reverse(), 8, new Map(), timing)).toEqual(plan)
  })

  it("keeps the file count as a cap when filling by seconds", () => {
    const timing = { weightOf: () => 1, target: 1000, boot: 17 }
    const specs = ["a", "b", "c"].map((n) => spec(`${n}.spec.ts`))
    const plan = planBundles(specs, 2, new Map(), timing)
    expect(plan.bundles.map((bundle) => bundle.specs.length)).toEqual([2, 1])
    expect(() => planBundles(specs, 2, new Map(), { ...timing, target: 0 })).toThrow(/target/)
  })

  it("refuses a size that is not a whole number from 1 up", () => {
    expect(() => planBundles([], 0)).toThrow(/whole number/)
    expect(() => planBundles([], 2.5)).toThrow(/whole number/)
  })
})

describe("bundleSource", () => {
  it("hands the bundle's class and files to the host", () => {
    const text = bundleSource({ kind: "strict", specs: ["a.spec.ts", "b.spec.ts"] })
    expect(text).toContain('require("../bundle/host").runBundle("strict", [')
    expect(text).toContain('  "a.spec.ts",\n  "b.spec.ts",\n])')
    expect(bundleSeconds(text)).toBeNull()
  })

  it("carries a weighed bundle's expected seconds for the sequencer", () => {
    const text = bundleSource({ kind: "plain", specs: ["a.spec.ts"], seconds: 123 })
    expect(bundleSeconds(text)).toBe(123)
  })
})
