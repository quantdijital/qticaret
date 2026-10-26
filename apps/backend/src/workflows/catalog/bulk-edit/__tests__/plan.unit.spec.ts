import type { BulkChange } from "../change"
import { planBulkChange, roundAmount } from "../plan"
import type { BulkPlan } from "../plan"
import type { BulkProduct, BulkVariant } from "../products"

const LOCATION = "sloc_1"
const context = { locationId: LOCATION }

const product = (fields: Partial<BulkProduct> = {}): BulkProduct => ({
  id: "prod_1",
  handle: "kupa",
  title: "Kupa",
  status: "draft",
  ...fields,
})

const priced = (id: string, prices: NonNullable<BulkVariant["prices"]>): BulkVariant => ({
  id,
  prices,
})
const tryPrice = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  currency_code: "try",
  amount,
  ...extra,
})

const writeOf = (plan: BulkPlan) => (plan.kind === "write" ? plan.write : undefined)

describe("bulk edit: price", () => {
  it("replaces the base TRY price and sends every other price back as it is", () => {
    const plan = planBulkChange(
      product({
        variants: [
          priced("var_1", [
            tryPrice("pr_try", 100),
            { id: "pr_eur", currency_code: "eur", amount: "5" },
            tryPrice("pr_list", 70, { price_list_id: "plist_1" }),
          ]),
        ],
      }),
      { action: "price", mode: "set", value: 150 },
      context
    )
    expect(writeOf(plan)).toEqual({
      action: "price",
      variants: [
        {
          id: "var_1",
          prices: [
            { id: "pr_eur", currency_code: "eur", amount: 5 },
            { id: "pr_try", currency_code: "try", amount: 150 },
          ],
        },
      ],
    })
  })

  it("rounds a percent or an amount change to the kuruş", () => {
    const variants = [priced("var_1", [tryPrice("pr_1", 19.99)])]
    const up = writeOf(
      planBulkChange(
        product({ variants }),
        { action: "price", mode: "percent", value: 10 },
        context
      )
    )
    expect(up).toMatchObject({ variants: [{ prices: [{ amount: 21.99 }] }] })
    const down = writeOf(
      planBulkChange(
        product({ variants }),
        { action: "price", mode: "amount", value: -0.5 },
        context
      )
    )
    expect(down).toMatchObject({ variants: [{ prices: [{ amount: 19.49 }] }] })
    expect(roundAmount(1.005)).toBe(1.01)
    expect(roundAmount(21.989)).toBe(21.99)
  })

  it("leaves the whole product when one variant's price would leave the range", () => {
    const plan = planBulkChange(
      product({
        variants: [priced("var_1", [tryPrice("a", 500)]), priced("var_2", [tryPrice("b", 50)])],
      }),
      { action: "price", mode: "amount", value: -100 },
      context
    )
    expect(plan).toEqual({ kind: "skipped", key: "bulk_edit.price_out_of_range" })
  })

  it("prices a variant that has none only when the price is set", () => {
    const variants = [priced("var_1", []), priced("var_2", [tryPrice("b", 50)])]
    const relative = planBulkChange(
      product({ variants }),
      { action: "price", mode: "percent", value: 20 },
      context
    )
    expect(writeOf(relative)).toMatchObject({ variants: [{ id: "var_2" }] })
    const none = planBulkChange(
      product({ variants: [priced("var_1", [])] }),
      { action: "price", mode: "percent", value: 20 },
      context
    )
    expect(none).toEqual({ kind: "skipped", key: "bulk_edit.no_price" })
    const set = planBulkChange(
      product({ variants: [priced("var_1", [tryPrice("ruled", 80, { rules_count: 1 })])] }),
      { action: "price", mode: "set", value: 90 },
      context
    )
    // A price with rules is not the base price: kept, and a base price added
    expect(writeOf(set)).toMatchObject({
      variants: [
        {
          prices: [
            { id: "ruled", amount: 80 },
            { currency_code: "try", amount: 90 },
          ],
        },
      ],
    })
  })

  it("changes nothing when the price is already so", () => {
    expect(
      planBulkChange(
        product({ variants: [priced("var_1", [tryPrice("a", "100" as unknown as number)])] }),
        { action: "price", mode: "set", value: 100 },
        context
      )
    ).toEqual({ kind: "unchanged" })
  })
})

const tracked = (id: string, quantity: number | null, manage = true): BulkVariant => ({
  id,
  manage_inventory: manage,
  inventory_items: [
    {
      inventory_item_id: `iitem_${id}`,
      inventory: {
        location_levels:
          quantity === null ? [] : [{ location_id: LOCATION, stocked_quantity: quantity }],
      },
    },
  ],
})

describe("bulk edit: stock", () => {
  it("sets the quantity at the default warehouse, making a level a variant lacks", () => {
    const plan = planBulkChange(
      product({ variants: [tracked("a", 2), tracked("b", null), tracked("c", 7)] }),
      { action: "stock", mode: "set", value: 7 },
      context
    )
    expect(writeOf(plan)).toEqual({
      action: "stock",
      update: [{ inventory_item_id: "iitem_a", location_id: LOCATION, stocked_quantity: 7 }],
      create: [{ inventory_item_id: "iitem_b", location_id: LOCATION, stocked_quantity: 7 }],
    })
  })

  it("refuses to take stock below zero, and leaves untracked products out", () => {
    expect(
      planBulkChange(
        product({ variants: [tracked("a", 3)] }),
        { action: "stock", mode: "adjust", value: -5 },
        context
      )
    ).toEqual({ kind: "skipped", key: "bulk_edit.stock_negative" })
    expect(
      planBulkChange(
        product({ variants: [tracked("a", 3, false)] }),
        { action: "stock", mode: "adjust", value: 5 },
        context
      )
    ).toEqual({ kind: "skipped", key: "bulk_edit.stock_untracked" })
    expect(
      planBulkChange(
        product({ variants: [tracked("a", null)] }),
        { action: "stock", mode: "set", value: 0 },
        context
      )
    ).toEqual({ kind: "unchanged" })
  })

  it("needs a default warehouse", () => {
    expect(
      planBulkChange(
        product({ variants: [tracked("a", 1)] }),
        { action: "stock", mode: "set", value: 4 },
        { locationId: null }
      )
    ).toEqual({ kind: "skipped", key: "bulk_edit.no_location" })
  })
})

describe("bulk edit: status, categories, SEO", () => {
  it("changes the status only when it differs", () => {
    expect(
      planBulkChange(
        product({ status: "published" }),
        { action: "status", status: "published" },
        context
      )
    ).toEqual({ kind: "unchanged" })
    expect(
      writeOf(planBulkChange(product(), { action: "status", status: "published" }, context))
    ).toEqual({ action: "status", status: "published" })
  })

  const inCategories = (ids: string[], primary: string | null = null) =>
    product({
      categories: ids.map((id) => ({ id })),
      product_extension: { primary_category_id: primary },
    })

  it("adds to and removes from a category, the primary one going with it", () => {
    const add = { action: "category", mode: "add", category_id: "pcat_b" } as const
    expect(writeOf(planBulkChange(inCategories(["pcat_a"]), add, context))).toEqual({
      action: "category",
      category_ids: ["pcat_a", "pcat_b"],
    })
    expect(planBulkChange(inCategories(["pcat_b"]), add, context)).toEqual({ kind: "unchanged" })
    const remove = { action: "category", mode: "remove", category_id: "pcat_a" } as const
    expect(
      writeOf(planBulkChange(inCategories(["pcat_a", "pcat_b"], "pcat_a"), remove, context))
    ).toEqual({ action: "category", category_ids: ["pcat_b"], primary_category_id: null })
    expect(writeOf(planBulkChange(inCategories(["pcat_a"], "pcat_z"), remove, context))).toEqual({
      action: "category",
      category_ids: [],
    })
    expect(planBulkChange(inCategories(["pcat_b"]), remove, context)).toEqual({ kind: "unchanged" })
  })

  it("makes a category the primary one, adding the product to it first", () => {
    const primary = { action: "category", mode: "primary", category_id: "pcat_b" } as const
    expect(writeOf(planBulkChange(inCategories(["pcat_a"]), primary, context))).toEqual({
      action: "category",
      category_ids: ["pcat_a", "pcat_b"],
      primary_category_id: "pcat_b",
    })
    expect(writeOf(planBulkChange(inCategories(["pcat_b"], "pcat_a"), primary, context))).toEqual({
      action: "category",
      primary_category_id: "pcat_b",
    })
    expect(planBulkChange(inCategories(["pcat_b"], "pcat_b"), primary, context)).toEqual({
      kind: "unchanged",
    })
  })

  it("gives the page's own SEO texts back to the templates", () => {
    const change: BulkChange = {
      action: "seo_template",
      fields: ["seo_title", "seo_description"],
    }
    expect(
      writeOf(
        planBulkChange(
          product({ seo_meta: { seo_title: "Özel başlık", seo_description: "  " } }),
          change,
          context
        )
      )
    ).toEqual({ action: "seo_template", values: { seo_title: null } })
    expect(planBulkChange(product({ seo_meta: null }), change, context)).toEqual({
      kind: "unchanged",
    })
  })
})

describe("bulk edit: alt texts", () => {
  const images = [
    { id: "img_2", url: "https://cdn/2.jpg", rank: 1, variants: [{ id: "var_white" }] },
    { id: "img_1", url: "https://cdn/1.jpg", rank: 0, variants: [] },
    { id: "img_3", url: "https://cdn/3.jpg", rank: 2, variants: [] },
    { id: "img_4", url: "https://cdn/4.jpg", rank: 3, variants: [] },
  ]
  const shirt = (assets: NonNullable<BulkProduct["media_assets"]>) =>
    product({
      title: "Keten Gömlek",
      options: [
        { id: "opt_color", title: "Renk" },
        { id: "opt_size", title: "Beden" },
      ],
      variants: [
        {
          id: "var_white",
          options: [
            { value: "M", option_id: "opt_size" },
            { value: "Beyaz", option_id: "opt_color" },
          ],
        },
      ],
      images,
      media_assets: assets,
    })

  it("fills the missing ones in image order, keeping those written", () => {
    const plan = planBulkChange(
      shirt([
        { id: "media_1", url: "https://cdn/1.jpg", alt: null },
        { id: "media_2", url: "https://cdn/2.jpg", alt: "" },
        { id: "media_3", url: "https://cdn/3.jpg", alt: "Elle yazılmış" },
        { id: "media_4", url: "https://cdn/4.jpg", alt: null },
        null,
      ]),
      { action: "alt_text" },
      context
    )
    expect(writeOf(plan)).toEqual({
      action: "alt_text",
      alts: [
        { id: "media_1", alt: "Keten Gömlek" },
        { id: "media_2", alt: "Keten Gömlek – Beyaz / M" },
        // The third image is the product's second plain one; the fourth its third
        { id: "media_4", alt: "Keten Gömlek, görsel 3" },
      ],
    })
  })

  it("says so when an image without a text has no record to hold one", () => {
    expect(
      planBulkChange(
        shirt([
          { id: "media_1", url: "https://cdn/1.jpg", alt: "Var" },
          { id: "media_2", url: "https://cdn/2.jpg", alt: "Var" },
          { id: "media_3", url: "https://cdn/3.jpg", alt: "Var" },
        ]),
        { action: "alt_text" },
        context
      )
    ).toEqual({ kind: "skipped", key: "bulk_edit.alt_no_record" })
    expect(
      planBulkChange(product({ images: [], media_assets: [] }), { action: "alt_text" }, context)
    ).toEqual({ kind: "unchanged" })
  })
})
