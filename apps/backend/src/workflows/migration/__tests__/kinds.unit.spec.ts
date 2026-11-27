import { MAX_SAMPLES, RUN_KINDS, addedKinds, groupProblems, withDependencies } from "../kinds"
import type { ReportProblem } from "../report"
import { RunPhases, weighted } from "../run-phase"

describe("withDependencies", () => {
  it("takes every kind when none is chosen", () => {
    expect(withDependencies([])).toEqual([...RUN_KINDS])
    expect(withDependencies(undefined)).toEqual([...RUN_KINDS])
  })

  it("adds what a kind needs, in the run's order", () => {
    expect(withDependencies(["image"])).toEqual(["category", "brand", "product", "image"])
    expect(withDependencies(["order"])).toEqual(["customer", "order"])
    expect(withDependencies(["review", "post"])).toEqual([
      "category",
      "brand",
      "product",
      "review",
      "post",
    ])
    expect(withDependencies(["page"])).toEqual(["page"])
  })

  it("names the kinds the server added", () => {
    expect(addedKinds(["image"], withDependencies(["image"]))).toEqual([
      "category",
      "brand",
      "product",
    ])
    expect(addedKinds([], withDependencies([]))).toEqual([])
  })
})

describe("groupProblems", () => {
  const problem = (kind: ReportProblem["kind"], key: string, source_key: string) => ({
    kind,
    key,
    source_key,
  })

  it("groups by kind and reason, the largest first, a few keys each", () => {
    const problems = [
      problem("product", "migration.product_handle_taken", "p1"),
      ...Array.from({ length: 14 }, (_, index) =>
        problem("image", "migration.image_unreachable", `p${String(index)} https://eski.test/a.jpg`)
      ),
      problem("product", "migration.product_handle_taken", "p2"),
    ]
    const groups = groupProblems(problems)
    expect(groups.map(({ kind, key, count }) => [kind, key, count])).toEqual([
      ["image", "migration.image_unreachable", 14],
      ["product", "migration.product_handle_taken", 2],
    ])
    expect(groups[0]?.samples).toHaveLength(MAX_SAMPLES)
    expect(groups[1]?.samples).toEqual(["p1", "p2"])
  })

  it("never keeps a person's key", () => {
    const [group] = groupProblems([problem("customer", "migration.customer_invalid", "a@b.test")])
    expect(group).toMatchObject({ count: 1, samples: [] })
  })
})

describe("RunPhases", () => {
  it("writes the live step at its edges and at most once a second between", async () => {
    const setPhase = jest.fn(() => Promise.resolve())
    let time = 0
    const phases = new RunPhases({ setPhase }, "mrun_1", ["product", "image"], () => time)
    await phases.at("image", 0, 10)
    time = 200
    await phases.at("image", 3, 10)
    time = 1300
    await phases.at("image", 5, 10)
    time = 1400
    await phases.at("image", 10, 10)
    expect(setPhase.mock.calls.map((call) => (call as unknown[])[1])).toEqual([
      { kinds: ["product", "image"], kind: "image", done: 0, total: 10 },
      { kinds: ["product", "image"], kind: "image", done: 5, total: 10 },
      { kinds: ["product", "image"], kind: "image", done: 10, total: 10 },
    ])
  })

  it("tells a step in another unit", async () => {
    const told: [number, number][] = []
    const progress = weighted([2, 0, 3], (done, total) => {
      told.push([done, total])
      return Promise.resolve()
    })
    await progress(1, 3)
    await progress(3, 3)
    expect(told).toEqual([
      [2, 5],
      [5, 5],
    ])
  })
})
