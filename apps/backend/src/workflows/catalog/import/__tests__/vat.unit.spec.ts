import { productsOf, vatNamesByType, vatRateOf, vatTypeChange } from "../../../../lib/catalog-sheet"
import type { SheetProduct } from "../../../../lib/catalog-sheet"
import type { VatRate } from "../../../../lib/tax"
import { productRows } from "../../export/rows"
import { planImport } from "../plan"
import type { ExistingProduct, ImportReferences } from "../references"

/*
 * The sheet's KDV column (adr/0007): a product's rate by its name, code or
 * percentage; unknown or ambiguous stops the row; a sheet without the
 * column still imports; an export uploaded again changes nothing.
 */

const rate = (over: Partial<VatRate> & Pick<VatRate, "id" | "name" | "rate">): VatRate => ({
  code: null,
  is_default: false,
  active: true,
  product_type_id: null,
  ...over,
})

const TWENTY = rate({ id: "txr_20", name: "KDV %20", code: "KDV20", rate: 20, is_default: true })
const TEN = rate({
  id: "txr_10",
  name: "KDV %10",
  code: "KDV10",
  rate: 10,
  product_type_id: "ptyp_10",
})
const RATES: VatRate[] = [
  TWENTY,
  TEN,
  rate({ id: "txr_1", name: "KDV %1", code: "KDV1", rate: 1, product_type_id: "ptyp_1" }),
  rate({ id: "txr_old", name: "KDV %8", rate: 8, product_type_id: "ptyp_8", active: false }),
]

describe("the KDV cell", () => {
  it("finds a rate by its name, code or percentage", () => {
    for (const cell of ["KDV %10", "kdv  %10", "KDV10", "10", "%10", "10 %", "10,0"]) {
      expect(vatRateOf(cell, RATES)).toEqual({ ok: true, rate: TEN })
    }
  })

  it("refuses an unknown or removed rate, and a percentage two rates share with no default", () => {
    expect(vatRateOf("18", RATES)).toEqual({ ok: false, key: "catalog_import.vat_unknown" })
    expect(vatRateOf("KDV %8", RATES)).toEqual({ ok: false, key: "catalog_import.vat_unknown" })
    expect(vatRateOf("on", RATES)).toEqual({ ok: false, key: "catalog_import.vat_unknown" })
    const twins = [...RATES, rate({ id: "txr_10b", name: "Gıda %10", rate: 10 })]
    expect(vatRateOf("10", twins)).toEqual({ ok: false, key: "catalog_import.vat_ambiguous" })
    expect(vatRateOf("Gıda %10", twins)).toMatchObject({ ok: true, rate: { id: "txr_10b" } })
    // Shared with the default: the default
    const withDefault = [...RATES, rate({ id: "txr_20b", name: "Diğer %20", rate: 20 })]
    expect(vatRateOf("20", withDefault)).toMatchObject({ ok: true, rate: { id: "txr_20" } })
  })

  it("moves a product only when it is taxed at another rate now", () => {
    expect(vatTypeChange(TEN, RATES, null)).toBe("ptyp_10")
    expect(vatTypeChange(TEN, RATES, "ptyp_10")).toBeUndefined()
    // Back to the default, bound to no type: off its type
    expect(vatTypeChange(TWENTY, RATES, "ptyp_10")).toBeNull()
    expect(vatTypeChange(TWENTY, RATES, null)).toBeUndefined()
    // A type no rate is on is taxed at the default
    expect(vatTypeChange(TWENTY, RATES, "ptyp_other")).toBeUndefined()
  })
})

const refs = (vatRates: VatRate[]): ImportReferences => ({
  categories: new Map(),
  collections: new Map(),
  brands: new Map(),
  templates: new Map(),
  products: new Map(),
  skus: new Map(),
  vatRates,
  shop: {
    locationId: null,
    salesChannelId: null,
    shippingProfileId: null,
    units: { weight: "g", dimension: "cm" },
  },
})

const sheet = (vat?: string): SheetProduct => ({
  handle: "kupa",
  isDerived: false,
  line: 2,
  fields: { title: "Kupa", ...(vat === undefined ? {} : { vat }) },
  attributes: {},
  variants: [{ line: 2, options: [] }],
})

describe("the import with a KDV column", () => {
  it("puts a new product on its rate's type, a default one on none", () => {
    expect(planImport(sheet("KDV %10"), refs(RATES)).plan?.product).toMatchObject({
      type_id: "ptyp_10",
    })
    expect(planImport(sheet("20"), refs(RATES)).plan?.product).not.toHaveProperty("type_id")
  })

  it("stops a row whose rate the shop does not have, saying the column", () => {
    const { plan, problems } = planImport(sheet("18"), refs(RATES))
    expect(plan).toBeNull()
    expect(problems).toEqual([{ line: 2, key: "catalog_import.vat_unknown", column: "KDV" }])
  })

  it("leaves the rate alone without the column, and reads a sheet that has none", () => {
    expect(planImport(sheet(), refs([])).plan?.product).not.toHaveProperty("type_id")
    const { products, problems } = productsOf(
      ["Tanıtıcı", "Ürün adı"],
      [{ line: 2, cells: ["kupa", "Kupa"] }]
    )
    expect(problems).toEqual([])
    expect(products[0]?.fields).toEqual({ title: "Kupa" })
  })

  it("writes back what an export said: the rate's name, and nothing changes", () => {
    const names = vatNamesByType(RATES)
    const [first] = productRows(
      { handle: "kupa", title: "Kupa", status: "draft", type_id: "ptyp_10" },
      [],
      null,
      names
    )
    const [plain] = productRows(
      { handle: "cay", title: "Çay", status: "draft", type_id: null },
      [],
      null,
      names
    )
    expect(first).toContain("KDV %10")
    expect(plain).toContain("KDV %20")
    const onTen: ExistingProduct = {
      id: "prod_1",
      handle: "kupa",
      options: [],
      variants: [],
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
        physical: true,
        typeId: "ptyp_10",
      },
    }
    const products = new Map([["kupa", onTen]])
    const again = planImport(sheet("KDV %10"), { ...refs(RATES), products })
    const back = planImport(sheet("KDV %20"), { ...refs(RATES), products })
    expect(again.problems).toEqual([])
    expect(again.plan?.product).not.toHaveProperty("type_id")
    expect(back.plan?.product).toMatchObject({ type_id: null })
  })
})
