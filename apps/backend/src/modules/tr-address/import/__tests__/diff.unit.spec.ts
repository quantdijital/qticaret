import { planLevel } from "../diff"
import type { ExistingRecord, PlanValues } from "../diff"

const existing = [
  { id: "1", key: "a", is_active: true, values: { name: "A" } },
  { id: "2", key: "b", is_active: false, values: { name: "B" } },
  { id: "3", key: "c", is_active: true, values: { name: "C" } },
]

const record = (
  id: string,
  key: string,
  externalId: string | null,
  isActive = true
): ExistingRecord<PlanValues> => ({
  id,
  key,
  externalId,
  is_active: isActive,
  values: { name: key, external_id: externalId },
})

const all = { shouldDeactivateMissing: true }

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
      { shouldDeactivateMissing: false }
    )

    expect(plan).toEqual({
      create: [{ name: "D" }],
      update: [
        { id: "2", name: "B", is_active: true },
        { id: "3", name: "C2", is_active: true },
      ],
      rekey: [],
      deactivate: [],
      unchanged: 1,
    })
  })

  it("deactivates active records missing from the input only when asked", () => {
    const desired = [{ key: "a", values: { name: "A" } }]

    expect(planLevel(existing, desired, { shouldDeactivateMissing: false }).deactivate).toEqual([])
    expect(planLevel(existing, desired, all).deactivate).toEqual(["3"])
  })

  it("follows a renamed place by its source id: updated and parked, not replaced", () => {
    const plan = planLevel(
      [record("1", "Eski", "tapi:1")],
      [{ key: "Yeni", externalId: "tapi:1", values: { name: "Yeni", external_id: "tapi:1" } }],
      all
    )

    expect(plan).toMatchObject({
      create: [],
      update: [{ id: "1", name: "Yeni" }],
      rekey: ["1"],
      deactivate: [],
    })
  })

  it("adopts a record without a source id by its name, and gives it the id", () => {
    const plan = planLevel(
      [record("1", "Kadıköy", null)],
      [
        {
          key: "Kadıköy",
          externalId: "tapi:9",
          values: { name: "Kadıköy", external_id: "tapi:9" },
        },
      ],
      all
    )

    expect(plan.update).toEqual([
      { id: "1", name: "Kadıköy", external_id: "tapi:9", is_active: true },
    ])
    expect(plan.rekey).toEqual([])
  })

  it("never takes by name a record whose own id is still in the input", () => {
    // 1 is renamed away from "Yeni"; 2, a new place, is called "Yeni" now
    const plan = planLevel(
      [record("1", "Yeni", "tapi:1")],
      [
        { key: "Yeni", externalId: "tapi:2", values: { name: "Yeni", external_id: "tapi:2" } },
        { key: "Başka", externalId: "tapi:1", values: { name: "Başka", external_id: "tapi:1" } },
      ],
      all
    )

    expect(plan.create).toEqual([{ name: "Yeni", external_id: "tapi:2" }])
    expect(plan.update).toMatchObject([{ id: "1", name: "Başka" }])
    expect(plan.rekey).toEqual(["1"])
  })

  it("takes the active record of a name before a removed one", () => {
    const plan = planLevel(
      [record("old", "Fatih", "tapi:1", false), record("new", "Fatih", null)],
      [{ key: "Fatih", values: { name: "Fatih" } }],
      all
    )

    expect(plan).toMatchObject({ update: [], unchanged: 1, deactivate: [] })
  })

  it("keeps a field the input leaves out (a file has no source ids)", () => {
    const plan = planLevel(
      [record("1", "Caferağa", "tapi:5")],
      [{ key: "Caferağa", values: { name: "Caferağa" } }],
      all
    )

    expect(plan).toMatchObject({ update: [], unchanged: 1 })
  })
})
