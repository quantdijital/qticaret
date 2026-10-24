import { planLevel } from "../diff"

const existing = [
  { id: "1", key: "a", is_active: true, values: { name: "A" } },
  { id: "2", key: "b", is_active: false, values: { name: "B" } },
  { id: "3", key: "c", is_active: true, values: { name: "C" } },
]

describe("planLevel", () => {
  it("creates new keys, updates changed or inactive ones and counts the rest", () => {
    const plan = planLevel(
      existing,
      [
        { key: "a", values: { name: "A" } },
        { key: "b", values: { name: "B" } },
        { key: "c", values: { name: "C2" } },
        { key: "d", values: { name: "D" } },
      ],
      { deactivateMissing: false }
    )

    expect(plan).toEqual({
      create: [{ name: "D" }],
      update: [
        { id: "2", name: "B", is_active: true },
        { id: "3", name: "C2", is_active: true },
      ],
      deactivate: [],
      unchanged: 1,
    })
  })

  it("deactivates active records missing from the input only when asked", () => {
    const desired = [{ key: "a", values: { name: "A" } }]

    expect(planLevel(existing, desired, { deactivateMissing: false }).deactivate).toEqual([])
    expect(planLevel(existing, desired, { deactivateMissing: true }).deactivate).toEqual(["3"])
  })
})
