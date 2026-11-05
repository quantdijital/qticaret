import { FILLED_BY, planReservationFill } from "../reservations"
import type { FillLine, HeldStock, ShelfLevel } from "../reservations"

const LOCATION = "sloc_depo"
const tracked = (...items: [string, number?][]): NonNullable<FillLine["variant"]> => ({
  manage_inventory: true,
  inventory_items: items.map(([id, required]) => ({
    inventory_item_id: id,
    required_quantity: required ?? 1,
  })),
})
const plan = (lines: FillLine[], held: HeldStock[] = [], levels: ShelfLevel[] = []) =>
  planReservationFill({ location_id: LOCATION, lines, held, levels })
const shelf = (id: string, stocked: number): ShelfLevel => ({
  inventory_item_id: id,
  stocked_quantity: stocked,
})

describe("planReservationFill (adr/0054, 2026-11-05: ship first, hold what is missing)", () => {
  it("holds nothing more for a line whose reservation covers the parcel", () => {
    const fill = plan(
      [{ id: "ordli_1", quantity: 2, variant: tracked(["iitem_1"]) }],
      [{ id: "resitem_1", line_item_id: "ordli_1", inventory_item_id: "iitem_1", quantity: 3 }],
      [shelf("iitem_1", 10)]
    )

    expect(fill).toEqual({ location_id: LOCATION, levels: [], create: [], raise: [], lines: [] })
  })

  it("makes the reservation of a tracked line that has none, at the parcel's warehouse", () => {
    const fill = plan(
      [{ id: "ordli_1", quantity: 2, variant: tracked(["iitem_1"]) }],
      [],
      [shelf("iitem_1", 10)]
    )

    expect(fill.create).toEqual([
      {
        line_item_id: "ordli_1",
        inventory_item_id: "iitem_1",
        location_id: LOCATION,
        quantity: 2,
        allow_backorder: true,
        metadata: { filled_by: FILLED_BY },
      },
    ])
    expect(fill.lines).toEqual([
      {
        line_item_id: "ordli_1",
        inventory_item_id: "iitem_1",
        kind: "created",
        quantity: 2,
        past_count: 0,
      },
    ])
    expect(fill.levels).toEqual([])
  })

  it("raises a reservation smaller than the parcel to its size, wherever it is held", () => {
    const fill = plan(
      [{ id: "ordli_1", quantity: 3, variant: tracked(["iitem_1"]) }],
      [{ id: "resitem_1", line_item_id: "ordli_1", inventory_item_id: "iitem_1", quantity: "1" }],
      [shelf("iitem_1", 10)]
    )

    expect(fill.raise).toEqual([{ id: "resitem_1", quantity: 3, allow_backorder: true }])
    expect(fill.create).toEqual([])
    expect(fill.lines).toMatchObject([{ kind: "raised", quantity: 2, past_count: 0 }])
  })

  it("leaves an untracked line, a line with no variant left and an empty one alone", () => {
    const fill = plan([
      {
        id: "ordli_1",
        quantity: 1,
        variant: { manage_inventory: false, inventory_items: [{ inventory_item_id: "iitem_1" }] },
      },
      { id: "ordli_2", quantity: 1, variant: null },
      { id: "ordli_3", quantity: 0, variant: tracked(["iitem_3"]) },
    ])

    expect(fill).toEqual({ location_id: LOCATION, levels: [], create: [], raise: [], lines: [] })
  })

  it("gives the warehouse a level at 0 for an item it has none of, and counts the units past it", () => {
    const fill = plan([{ id: "ordli_1", quantity: 2, variant: tracked(["iitem_1"]) }])

    expect(fill.levels).toEqual([
      { inventory_item_id: "iitem_1", location_id: LOCATION, stocked_quantity: 0 },
    ])
    expect(fill.lines).toMatchObject([{ kind: "created", quantity: 2, past_count: 2 }])
  })

  it("makes the level even when the line is held elsewhere: Medusa takes the units off this warehouse", () => {
    const fill = plan(
      [{ id: "ordli_1", quantity: 1, variant: tracked(["iitem_1"]) }],
      [{ id: "resitem_1", line_item_id: "ordli_1", inventory_item_id: "iitem_1", quantity: 1 }]
    )

    expect(fill.levels).toHaveLength(1)
    expect(fill.create).toEqual([])
    expect(fill.lines).toEqual([])
  })

  it("holds a kit's units per component, by its required quantity", () => {
    const fill = plan(
      [{ id: "ordli_1", quantity: 2, variant: tracked(["iitem_blade", 1], ["iitem_case", 2]) }],
      [{ id: "resitem_1", line_item_id: "ordli_1", inventory_item_id: "iitem_blade", quantity: 2 }],
      [shelf("iitem_blade", 5), shelf("iitem_case", 5)]
    )

    // The blade is held; the case's reservation is gone and comes back for 2 × 2
    expect(fill.create).toMatchObject([{ inventory_item_id: "iitem_case", quantity: 4 }])
    expect(fill.raise).toEqual([])
  })

  it("counts the shelf once for two lines of one item", () => {
    const fill = plan(
      [
        { id: "ordli_1", quantity: 2, variant: tracked(["iitem_1"]) },
        { id: "ordli_2", quantity: 2, variant: tracked(["iitem_1"]) },
      ],
      [],
      [shelf("iitem_1", 3)]
    )

    expect(fill.lines.map((line) => line.past_count)).toEqual([0, 1])
    expect(fill.levels).toEqual([])
  })

  it("keeps Medusa's own rule for an item held in several reservations on one line", () => {
    const fill = plan(
      [{ id: "ordli_1", quantity: 2, variant: tracked(["iitem_1"]) }],
      [
        { id: "resitem_1", line_item_id: "ordli_1", inventory_item_id: "iitem_1", quantity: 1 },
        { id: "resitem_2", line_item_id: "ordli_1", inventory_item_id: "iitem_1", quantity: 1 },
      ],
      [shelf("iitem_1", 10)]
    )

    expect(fill.create).toEqual([])
    expect(fill.raise).toEqual([])
  })
})
