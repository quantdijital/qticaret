import {
  BACKORDER_MARK,
  markEntriesOf,
  planShelfRaise,
  raisedUnits,
  withMarkEntries,
} from "../backorder"
import type { ShelfLine } from "../backorder"

const line = (overrides: Partial<ShelfLine> = {}): ShelfLine => ({
  quantity: 1,
  tracked: true,
  links: [
    {
      inventory_item_id: "iitem_kahve",
      required_quantity: 1,
      levels: [{ location_id: "sloc_depo", stocked: 1, reserved: 1 }],
    },
  ],
  ...overrides,
})

describe("planShelfRaise (adr/0026 Ek 2026-11-06, security review 2026-11-09)", () => {
  it("raises the level by exactly what the cart's lines lack there", () => {
    expect(planShelfRaise([line(), line({ quantity: 2 })], ["sloc_depo"])).toEqual({
      levels: [],
      raises: [{ inventory_item_id: "iitem_kahve", location_id: "sloc_depo", quantity: 3 }],
    })
  })

  it("raises the warehouse with the most free, by what it lacks; none when one has enough", () => {
    const levels = [
      { location_id: "sloc_a", stocked: 5, reserved: 5 },
      { location_id: "sloc_b", stocked: 3, reserved: 2 },
      // Not one of the channel's: never counted
      { location_id: "sloc_other", stocked: 50, reserved: 0 },
    ]
    const short = line({
      quantity: 2,
      links: [{ inventory_item_id: "iitem_1", required_quantity: 1, levels }],
    })
    const enough = line({
      quantity: 1,
      links: [{ inventory_item_id: "iitem_1", required_quantity: 1, levels }],
    })

    expect(planShelfRaise([short], ["sloc_a", "sloc_b"]).raises).toEqual([
      { inventory_item_id: "iitem_1", location_id: "sloc_b", quantity: 1 },
    ])
    expect(planShelfRaise([enough], ["sloc_a", "sloc_b"]).raises).toEqual([])
  })

  it("opens a level at the channel's first warehouse for an item none keeps, raised whole", () => {
    const bare = line({
      quantity: 2,
      links: [{ inventory_item_id: "iitem_2", required_quantity: 2, levels: [] }],
    })

    expect(planShelfRaise([bare], ["sloc_a", "sloc_b"])).toEqual({
      levels: [{ inventory_item_id: "iitem_2", location_id: "sloc_a", stocked_quantity: 0 }],
      raises: [{ inventory_item_id: "iitem_2", location_id: "sloc_a", quantity: 4 }],
    })
  })

  it("leaves lines that are not tracked or sell past the shelf alone", () => {
    expect(planShelfRaise([line({ tracked: false, quantity: 9 })], ["sloc_depo"]).raises).toEqual(
      []
    )
  })
})

describe("the raise's mark on its level", () => {
  const entry = { cart_id: "cart_1", quantity: 2, expires_at: "2026-11-09T10:05:00.000Z" }

  it("is kept beside the level's own metadata and taken off whole", () => {
    const marked = withMarkEntries({ note: "raf 3" }, [entry])

    expect(marked).toEqual({ note: "raf 3", [BACKORDER_MARK]: [entry] })
    expect(markEntriesOf(marked)).toEqual([entry])
    expect(raisedUnits(marked)).toBe(2)
    // Sent as "" so Medusa's metadata merge drops the key
    expect(withMarkEntries(marked, [])).toEqual({ note: "raf 3", [BACKORDER_MARK]: "" })
    expect(markEntriesOf(withMarkEntries(marked, []))).toEqual([])
  })

  it("reads only whole entries", () => {
    const metadata = {
      [BACKORDER_MARK]: [
        entry,
        { cart_id: "cart_2", quantity: "1" },
        { cart_id: "x", quantity: 0 },
      ],
    }

    expect(markEntriesOf(metadata)).toEqual([entry])
    expect(markEntriesOf({ [BACKORDER_MARK]: "yes" })).toEqual([])
    expect(raisedUnits(null)).toBe(0)
  })
})
