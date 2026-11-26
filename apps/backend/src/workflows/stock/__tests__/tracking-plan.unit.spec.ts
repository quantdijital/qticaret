import { planTracking } from "../tracking-plan"
import type { SkuItem, TrackingInput, TrackingVariantRow } from "../tracking-plan"

const LOC = "sloc_1"

const input = (tracked: boolean, variants: TrackingInput["variants"]): TrackingInput => ({
  product_id: "prod_1",
  tracked,
  variants,
  actor_id: null,
})

const row = (id: string, extra: Partial<TrackingVariantRow> = {}): TrackingVariantRow => ({
  id,
  title: `Varyant ${id}`,
  sku: null,
  manage_inventory: false,
  product: { product_extension: { kind: "physical", booking_mode: "none" } },
  inventory_items: [],
  ...extra,
})

const linked = (itemId: string, levels: { stocked: number; reserved?: number }[] = []) => [
  {
    inventory_item_id: itemId,
    required_quantity: 1,
    inventory: {
      location_levels: levels.map((level) => ({
        location_id: LOC,
        stocked_quantity: level.stocked,
        reserved_quantity: level.reserved ?? 0,
      })),
    },
  },
]

/** The i18n key a refused plan throws with; null when it is not refused. */
function refusal(plan: () => unknown): string | null {
  try {
    plan()
  } catch (error) {
    return (error as { safeMessage?: string }).safeMessage ?? null
  }
  return null
}

describe("planTracking", () => {
  it("makes an item for an untracked variant with none, its level holding the count", () => {
    const plan = planTracking(input(true, [{ id: "v1", quantity: 7 }]), [row("v1")], LOC, [])
    expect(plan.link).toHaveLength(1)
    expect(plan.link[0]).toMatchObject({ variant_id: "v1", relink: null, quantity: 7 })
    expect(plan.link[0]?.create).toMatchObject({ title: "Varyant v1", requires_shipping: true })
    expect(plan.flip).toEqual([{ id: "v1", manage_inventory: false }])
    expect(plan.create).toEqual([])
  })

  it("keeps a kept item and writes the count on its level", () => {
    const plan = planTracking(
      input(true, [{ id: "v1", quantity: 7 }]),
      [row("v1", { inventory_items: linked("iitem_1", [{ stocked: 3 }]) })],
      LOC,
      []
    )
    expect(plan.link).toEqual([])
    expect(plan.update).toEqual([
      { inventory_item_id: "iitem_1", location_id: LOC, stocked_quantity: 7 },
    ])
  })

  it("makes a missing level and changes nothing for a tracked variant without a count", () => {
    const missing = planTracking(
      input(true, [{ id: "v1" }]),
      [row("v1", { inventory_items: linked("iitem_1") })],
      LOC,
      []
    )
    expect(missing.create).toEqual([
      { inventory_item_id: "iitem_1", location_id: LOC, stocked_quantity: 0 },
    ])
    const same = planTracking(
      input(true, [{ id: "v1", quantity: 4 }]),
      [row("v1", { manage_inventory: true, inventory_items: linked("iitem_1", [{ stocked: 4 }]) })],
      LOC,
      []
    )
    expect(same).toMatchObject({ link: [], create: [], update: [], flip: [] })
  })

  it("links an unlinked item with the variant's SKU again; a linked one leaves the SKU off", () => {
    const orphan: SkuItem = {
      id: "iitem_old",
      sku: "BCK-1",
      linked: false,
      levels: [{ location_id: LOC, stocked_quantity: 5 }],
    }
    const plan = planTracking(input(true, [{ id: "v1" }]), [row("v1", { sku: "BCK-1" })], LOC, [
      orphan,
    ])
    expect(plan.link).toEqual([expect.objectContaining({ relink: "iitem_old", create: null })])
    expect(plan.create).toEqual([])
    const taken = planTracking(input(true, [{ id: "v1" }]), [row("v1", { sku: "BCK-1" })], LOC, [
      { ...orphan, linked: true },
    ])
    expect(taken.link[0]?.create?.sku).toBeNull()
  })

  it("makes a digital product's item need no shipping", () => {
    const plan = planTracking(
      input(true, [{ id: "v1" }]),
      [row("v1", { product: { product_extension: { kind: "digital" } } })],
      LOC,
      []
    )
    expect(plan.link[0]?.create?.requires_shipping).toBe(false)
  })

  it("refuses a dated product, a shop without a location and a kit's count", () => {
    const dated = row("v1", { product: { product_extension: { booking_mode: "departure" } } })
    expect(refusal(() => planTracking(input(true, [{ id: "v1" }]), [dated], LOC, []))).toBe(
      "stock_tracking.dated"
    )
    expect(refusal(() => planTracking(input(true, [{ id: "v1" }]), [row("v1")], null, []))).toBe(
      "stock_tracking.no_location"
    )
    const kit = row("v1", {
      inventory_items: [...linked("iitem_a"), ...linked("iitem_b")],
    })
    expect(
      refusal(() => planTracking(input(true, [{ id: "v1", quantity: 2 }]), [kit], LOC, []))
    ).toBe("stock_tracking.kit")
  })

  it("refuses two different counts for one item two variants share", () => {
    const shared = linked("iitem_1", [{ stocked: 1 }])
    const rows = [row("v1", { inventory_items: shared }), row("v2", { inventory_items: shared })]
    expect(
      refusal(() =>
        planTracking(
          input(true, [
            { id: "v1", quantity: 2 },
            { id: "v2", quantity: 3 },
          ]),
          rows,
          LOC,
          []
        )
      )
    ).toBe("stock_tracking.shared_count")
    const same = planTracking(
      input(true, [
        { id: "v1", quantity: 2 },
        { id: "v2", quantity: 2 },
      ]),
      rows,
      LOC,
      []
    )
    expect(same.update).toHaveLength(1)
  })

  it("turns off by the flag alone, refused while orders hold its stock", () => {
    const tracked = row("v1", {
      manage_inventory: true,
      inventory_items: linked("iitem_1", [{ stocked: 3 }]),
    })
    expect(planTracking(input(false, [{ id: "v1" }]), [tracked], LOC, [])).toMatchObject({
      link: [],
      create: [],
      update: [],
      flip: [{ id: "v1", manage_inventory: true }],
      tracked: false,
    })
    const held = row("v1", {
      manage_inventory: true,
      inventory_items: linked("iitem_1", [{ stocked: 3, reserved: 1 }]),
    })
    expect(refusal(() => planTracking(input(false, [{ id: "v1" }]), [held], LOC, []))).toBe(
      "stock_tracking.reserved"
    )
  })
})
