import type { SheetProduct } from "../../../../lib/catalog-sheet"
import { planImport } from "../plan"
import type { ExistingProduct, ImportReferences } from "../references"

const refs = (overrides: Partial<ImportReferences> = {}): ImportReferences => ({
  categories: new Map([["mutfak", { id: "pcat_1", name: "Mutfak" }]]),
  collections: new Map(),
  brands: new Map([["atolye", { id: "brand_1", name: "Atölye" }]]),
  templates: new Map([
    [
      "kupa",
      {
        id: "tmpl_1",
        definitions: [
          {
            key: "malzeme",
            type: "select",
            scope: "product",
            is_required: true,
            options: [{ value: "seramik", label: "Seramik" }],
          },
        ],
      },
    ],
  ]),
  products: new Map(),
  skus: new Map(),
  shop: {
    locationId: "sloc_1",
    salesChannelId: "sc_1",
    shippingProfileId: "sp_1",
    units: { weight: "g", dimension: "cm" },
  },
  ...overrides,
})

const product = (overrides: Partial<SheetProduct> = {}): SheetProduct => ({
  handle: "kupa",
  isDerived: false,
  line: 2,
  fields: { title: "Kupa" },
  attributes: {},
  variants: [{ line: 2, options: [], price: 100, stock: 3 }],
  ...overrides,
})

const existing: ExistingProduct = {
  id: "prod_1",
  handle: "kupa",
  templateHandle: null,
  attributes: {},
  current: {
    title: "Kupa",
    description: null,
    status: "draft",
    collection_id: null,
    weight: null,
    length: null,
    width: null,
    height: null,
    categoryIds: [],
    brandId: null,
    primaryCategoryId: null,
    seo: { seo_title: null, seo_description: null, focus_keyword: null },
  },
  options: [{ id: "opt_1", title: "Beden", values: ["S", "M"] }],
  variants: [
    {
      id: "var_s",
      sku: "K-S",
      ean: null,
      options: { beden: "S" },
      prices: [
        { id: "p_try", currency_code: "try", amount: 90, isBase: true },
        { id: "p_tier", currency_code: "try", amount: 80, isBase: false },
        { id: "p_eur", currency_code: "eur", amount: 4, isBase: true },
      ],
      inventoryItemId: "iitem_s",
      levels: { sloc_1: 2 },
      cost: null,
    },
    {
      id: "var_m",
      sku: null,
      ean: null,
      options: { beden: "M" },
      prices: [],
      inventoryItemId: null,
      levels: {},
      cost: null,
    },
  ],
}

const withExisting = () => refs({ products: new Map([["kupa", existing]]) })

describe("import plan", () => {
  it("makes a new product as the panel does: the default option, its channel and profile", () => {
    const { plan, problems } = planImport(
      product({ fields: { title: "Kupa", categories: ["mutfak"], brand: "atolye" } }),
      refs()
    )
    expect(problems).toEqual([])
    expect(plan).toMatchObject({
      productId: null,
      product: {
        handle: "kupa",
        status: "draft",
        categories: [{ id: "pcat_1" }],
        shipping_profile_id: "sp_1",
        sales_channels: [{ id: "sc_1" }],
      },
      brandId: "brand_1",
      primaryCategoryId: "pcat_1",
      options: [{ title: "Seçenek", values: ["Standart"] }],
      variantCreates: [
        { options: { Seçenek: "Standart" }, prices: [{ currency_code: "try", amount: 100 }] },
      ],
      stock: [{ variantId: null, quantity: 3 }],
    })
  })

  it("replaces only the base TRY price, keeping tiers and other currencies, and writes only changes", () => {
    const { plan } = planImport(
      product({
        fields: { title: "Kupa" },
        variants: [{ line: 2, options: [["Beden", "s"]], sku: "K-S", price: 120, stock: 2 }],
      }),
      withExisting()
    )
    expect(plan?.product).toEqual({})
    expect(plan?.variantUpdates).toEqual([
      {
        id: "var_s",
        prices: [
          { id: "p_tier", currency_code: "try", amount: 80 },
          { id: "p_eur", currency_code: "eur", amount: 4 },
          { id: "p_try", currency_code: "try", amount: 120 },
        ],
      },
    ])
    // The warehouse has 2 already
    expect(plan?.stock).toEqual([])
  })

  it("plans a unit cost only where it changes, a new variant's by its options", () => {
    const fresh = planImport(
      product({ fields: { title: "Kupa" }, variants: [{ line: 2, options: [], cost: 42.5 }] }),
      refs()
    )
    const { plan } = planImport(
      product({
        fields: { title: "Kupa" },
        variants: [
          { line: 2, options: [["Beden", "S"]], sku: "K-S", cost: 30 },
          { line: 3, options: [["Beden", "M"]], cost: 0 },
        ],
      }),
      refs({
        products: new Map([
          ["kupa", { ...existing, variants: existing.variants.map((v) => ({ ...v, cost: 3000 })) }],
        ]),
      })
    )

    expect(fresh.plan?.costs).toEqual([
      { variantId: null, key: expect.any(String) as unknown, cost: 42.5 },
    ])
    // S has 30,00 ₺ already; M's is new
    expect(plan?.costs).toEqual([
      { variantId: "var_m", key: expect.any(String) as unknown, cost: 0 },
    ])
  })

  it.each([
    [
      "two rows for one variant",
      [["Beden", "S"]],
      [["Beden", "S"]],
      "catalog_import.variant_matched_twice",
    ],
    [
      "a SKU whose variant has other options",
      [["Beden", "M"]],
      null,
      "catalog_import.options_mismatch",
    ],
  ] as const)("refuses %s", (_label, first, second, key) => {
    const variants = [
      {
        line: 2,
        options: first.map(([name, value]) => [name, value] as [string, string]),
        sku: "K-S",
      },
      ...(second
        ? [{ line: 3, options: second.map(([name, value]) => [name, value] as [string, string]) }]
        : []),
    ]
    const { problems } = planImport(product({ variants }), withExisting())
    expect(problems.map((problem) => problem.key)).toContain(key)
  })

  it("refuses stock for a variant that keeps none, and a new product going live without measurements", () => {
    const untracked = planImport(
      product({ variants: [{ line: 2, options: [["Beden", "M"]], stock: 4 }] }),
      withExisting()
    )
    expect(untracked.problems.map((problem) => problem.key)).toEqual([
      "catalog_import.stock_untracked",
    ])
    const live = planImport(product({ fields: { title: "Kupa", status: "published" } }), refs())
    expect(live.problems.map((problem) => problem.key)).toEqual(["catalog.dimensions_required"])
  })

  it.each([
    [
      "a new option value",
      { variants: [{ line: 2, options: [["Beden", "XL"]] }] },
      "catalog_import.option_value_unknown",
    ],
    [
      "an option the product lacks",
      { variants: [{ line: 2, options: [["Renk", "Mavi"]] }] },
      "catalog_import.option_unknown",
    ],
    ["a title's handle that is taken", { isDerived: true }, "catalog_import.handle_exists"],
    [
      "a category that is not there",
      { fields: { categories: ["yok"] } },
      "catalog_import.category_unknown",
    ],
  ] as const)("refuses %s", (_label, overrides, key) => {
    const { plan, problems } = planImport(
      product(overrides as Partial<SheetProduct>),
      withExisting()
    )
    expect(plan).toBeNull()
    expect(problems.map((problem) => problem.key)).toContain(key)
  })

  it("reads attributes by their template, by name or value, and wants the required ones", () => {
    const named = planImport(
      product({ fields: { title: "Kupa", template: "kupa" }, attributes: { malzeme: "Seramik" } }),
      refs()
    )
    expect(named.plan?.attributes).toEqual({
      template_id: "tmpl_1",
      values: { malzeme: "seramik" },
    })
    const missing = planImport(product({ fields: { title: "Kupa", template: "kupa" } }), refs())
    expect(missing.problems.map((problem) => problem.key)).toEqual([
      "catalog_import.attribute_required",
    ])
    const stray = planImport(product({ attributes: { malzeme: "Seramik" } }), refs())
    expect(stray.problems.map((problem) => problem.key)).toEqual([
      "catalog_import.template_required",
    ])
  })

  it("refuses a SKU another product holds, and stock without a warehouse", () => {
    const taken = planImport(
      product({ variants: [{ line: 2, options: [], sku: "X-1" }] }),
      refs({ skus: new Map([["x-1", "baska-urun"]]) })
    )
    expect(taken.problems.map((problem) => problem.key)).toEqual(["catalog_import.sku_taken"])
    const noLocation = planImport(product(), refs({ shop: { ...refs().shop, locationId: null } }))
    expect(noLocation.problems.map((problem) => problem.key)).toEqual([
      "catalog_import.no_location",
    ])
  })
})
