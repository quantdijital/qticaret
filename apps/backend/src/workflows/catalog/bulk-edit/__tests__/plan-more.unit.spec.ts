import { kurus } from "../../../../lib/money"
import type { ExistingSale } from "../../../pricing/variant-sale/plan"
import { BulkChange } from "../change"
import { planBulkChange } from "../plan"
import type { BulkPlan, PlanContext } from "../plan"
import type { BulkProduct } from "../products"

const NOW = new Date("2026-11-26T10:00:00.000Z")
const context: PlanContext = { locationId: null, now: NOW }

const product = (fields: Partial<BulkProduct> = {}): BulkProduct => ({
  id: "prod_1",
  handle: "bicak",
  title: "Bıçak",
  status: "published",
  ...fields,
})

const change = (input: Record<string, unknown>) => BulkChange.parse(input)
const writeOf = (plan: BulkPlan) => (plan.kind === "write" ? plan.write : undefined)

describe("bulk edit: the change's own checks", () => {
  it("takes a sale off by percent or amount, or cleared, and nothing else", () => {
    expect(change({ action: "sale", mode: "percent", value: 20 })).toMatchObject({
      starts_at: null,
      ends_at: null,
    })
    expect(() => change({ action: "sale", mode: "percent", value: 100 })).toThrow()
    expect(() => change({ action: "sale", mode: "amount" })).toThrow()
    expect(() => change({ action: "sale", mode: "clear", value: 5 })).toThrow()
    expect(() =>
      change({
        action: "sale",
        mode: "percent",
        value: 10,
        starts_at: "2026-12-02T00:00:00.000Z",
        ends_at: "2026-12-01T00:00:00.000Z",
      })
    ).toThrow()
    // A total is never taken from the panel
    expect(() => change({ action: "sale", mode: "percent", value: 10, amount: 80 })).toThrow()
  })

  it("takes a tag by a name of 1–100 letters", () => {
    expect(change({ action: "tag", mode: "add", value: "  Yeni  " })).toMatchObject({
      value: "Yeni",
    })
    expect(() => change({ action: "tag", mode: "add", value: " " })).toThrow()
    expect(() => change({ action: "tag", mode: "add", value: "x".repeat(101) })).toThrow()
  })
})

describe("bulk edit: brand", () => {
  it("sets, keeps or takes off the brand", () => {
    const branded = product({ brand: { id: "brand_a" } })
    expect(
      planBulkChange(branded, change({ action: "brand", brand_id: "brand_a" }), context)
    ).toEqual({ kind: "unchanged" })
    expect(
      writeOf(planBulkChange(branded, change({ action: "brand", brand_id: "brand_b" }), context))
    ).toEqual({ action: "brand", brand_id: "brand_b" })
    expect(
      writeOf(planBulkChange(branded, change({ action: "brand", brand_id: null }), context))
    ).toEqual({ action: "brand", brand_id: null })
    expect(
      planBulkChange(product({ brand: null }), change({ action: "brand", brand_id: null }), context)
    ).toEqual({ kind: "unchanged" })
  })
})

describe("bulk edit: tag", () => {
  const tagged = product({
    tags: [
      { id: "ptag_a", value: "Şef" },
      { id: "ptag_b", value: "Hediye" },
    ],
  })

  it("adds a tag the product lacks, keeping the others", () => {
    const plan = planBulkChange(tagged, change({ action: "tag", mode: "add", value: "Yeni" }), {
      ...context,
      tag: { id: "ptag_c", value: "Yeni" },
    })
    expect(writeOf(plan)).toEqual({ action: "tag", tag_ids: ["ptag_a", "ptag_b", "ptag_c"] })
  })

  it("leaves a product that has it already, matched by name while still to be made", () => {
    expect(
      planBulkChange(tagged, change({ action: "tag", mode: "add", value: "şef" }), {
        ...context,
        tag: { id: null, value: "şef" },
      })
    ).toEqual({ kind: "unchanged" })
  })

  it("takes a tag off, and leaves a product without it", () => {
    const remove = change({ action: "tag", mode: "remove", value: "Hediye" })
    const tag = { id: "ptag_b", value: "Hediye" }
    expect(writeOf(planBulkChange(tagged, remove, { ...context, tag }))).toEqual({
      action: "tag",
      tag_ids: ["ptag_a"],
    })
    expect(planBulkChange(product({ tags: [] }), remove, { ...context, tag })).toEqual({
      kind: "unchanged",
    })
  })
})

describe("bulk edit: selling past stock", () => {
  it("turns it on for tracked variants only", () => {
    const plan = planBulkChange(
      product({
        variants: [
          { id: "var_1", manage_inventory: true, allow_backorder: false },
          { id: "var_2", manage_inventory: true, allow_backorder: true },
          // Untracked stock always sells: left as it is
          { id: "var_3", manage_inventory: false, allow_backorder: false },
        ],
      }),
      change({ action: "backorder", allow: true }),
      context
    )
    expect(writeOf(plan)).toEqual({
      action: "backorder",
      variants: [{ id: "var_1", allow_backorder: true }],
    })
  })

  it("skips a product whose stock is not tracked at all", () => {
    expect(
      planBulkChange(
        product({ variants: [{ id: "var_1", manage_inventory: false }] }),
        change({ action: "backorder", allow: false }),
        context
      )
    ).toEqual({ kind: "skipped", key: "bulk_edit.stock_untracked" })
  })
})

describe("bulk edit: sale price", () => {
  const sale = (variantId: string, amount: number): ExistingSale => ({
    price_list_id: `plist_${variantId}`,
    variant_id: variantId,
    amount: kurus(amount),
    starts_at: null,
    ends_at: null,
  })
  const withSales = (
    existing: [string, ExistingSale[]][] = [],
    base: (number | null)[] = [10000]
  ) =>
    product({
      sale: {
        title: "Bıçak",
        variants: base.map((amount, index) => ({
          id: `var_${String(index + 1)}`,
          title: null,
          setId: `pset_${String(index + 1)}`,
          base: amount === null ? null : kurus(amount),
        })),
        existing: new Map(existing),
      },
    })

  it("asks a share off each priced variant, worked out by the sale's own workflow", () => {
    const plan = planBulkChange(
      withSales([], [10000, null]),
      change({ action: "sale", mode: "percent", value: 12.5 }),
      context
    )
    expect(writeOf(plan)).toEqual({
      action: "sale",
      set: [{ variant_id: "var_1", amount: null, rate_bps: 1250, starts_at: null, ends_at: null }],
      clear: [],
    })
    expect(plan.kind === "write" ? plan.diff : null).toEqual({
      "variant:var_1:sale": { before: null, after: 87.5 },
    })
  })

  it("takes an amount off the regular price, and skips a product it would make free", () => {
    const off = (value: number) =>
      planBulkChange(withSales(), change({ action: "sale", mode: "amount", value }), context)
    expect(writeOf(off(15))).toMatchObject({ set: [{ variant_id: "var_1", amount: 8500 }] })
    expect(off(100)).toEqual({ kind: "skipped", key: "bulk_edit.sale_out_of_range" })
  })

  it("leaves a sale already so, and skips a product without a regular price", () => {
    expect(
      planBulkChange(
        withSales([["var_1", [sale("var_1", 8000)]]]),
        change({ action: "sale", mode: "percent", value: 20 }),
        context
      )
    ).toEqual({ kind: "unchanged" })
    expect(
      planBulkChange(
        withSales([], [null]),
        change({ action: "sale", mode: "percent", value: 20 }),
        context
      )
    ).toEqual({ kind: "skipped", key: "bulk_edit.no_price" })
  })

  it("refuses a sale already over by the product page's rule", () => {
    expect(
      planBulkChange(
        withSales(),
        change({
          action: "sale",
          mode: "percent",
          value: 20,
          ends_at: "2026-11-01T00:00:00.000Z",
        }),
        context
      )
    ).toEqual({ kind: "skipped", key: "variant_sale.ended" })
  })

  it("clears the variants that have a sale, and leaves a product without one", () => {
    const clear = change({ action: "sale", mode: "clear" })
    expect(
      writeOf(planBulkChange(withSales([["var_1", [sale("var_1", 8000)]]]), clear, context))
    ).toEqual({ action: "sale", set: [], clear: ["var_1"] })
    expect(planBulkChange(withSales(), clear, context)).toEqual({ kind: "unchanged" })
  })
})
