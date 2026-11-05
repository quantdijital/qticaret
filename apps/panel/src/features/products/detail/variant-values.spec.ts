import { describe, expect, it } from "vitest"
import type { ProductDetail } from "@/features/products/api/products"
import { firstUncoded, gtinField } from "./variant-codes"
import {
  imagesFor,
  moveTied,
  priceEdit,
  savedVariant,
  variantEdit,
  variantSchemaFor,
} from "./variant-values"
import type { Variant, VariantImage, VariantValues } from "./variant-values"

const variant = (
  id: string,
  levels: { location_id: string; stocked_quantity: number }[],
  codes: { sku?: string; ean?: string; upc?: string; barcode?: string; weight?: number } = {}
) =>
  ({
    id,
    manage_inventory: true,
    allow_backorder: false,
    sku: null,
    ean: null,
    upc: null,
    barcode: null,
    ...codes,
    prices: [{ id: `price_${id}`, amount: 249, currency_code: "try" }],
    inventory_items: [
      {
        inventory_item_id: `iitem_${id}`,
        inventory: { location_levels: levels.map((level) => ({ ...level, reserved_quantity: 0 })) },
      },
    ],
  }) as unknown as Variant

const catalogRow = (id: string, extra: { cost?: number; mpn?: string } = {}) => ({
  id,
  title: null,
  sku: null,
  gtin: null,
  cost: extra.cost ?? null,
  mpn: extra.mpn ?? null,
})

const PRODUCT = {
  id: "prod_1",
  weight: 450,
  images: [
    { id: "img_2", url: "https://cdn/2.jpg", rank: 1, variants: [{ id: "a" }] },
    { id: "img_1", url: "https://cdn/1.jpg", rank: 0, variants: [] },
    { id: "img_3", url: "https://cdn/3.jpg", rank: 2, variants: [{ id: "b" }] },
  ],
  media_assets: [
    { id: "media_1", url: "https://cdn/1.jpg", alt: "Önden", file_id: "f1", derived_at: null },
    { id: "media_2", url: "https://cdn/2.jpg", alt: null, file_id: "f2", derived_at: null },
  ],
} as unknown as ProductDetail

const read = (each: Variant, location: string | null = "sloc_1", cost?: number) =>
  savedVariant(
    PRODUCT,
    each,
    location,
    cost === undefined ? undefined : catalogRow(each.id, { cost })
  )

describe("a variant's values", () => {
  const a = variant("a", [{ location_id: "sloc_1", stocked_quantity: 4 }], { weight: 300 })
  const b = variant("b", [])

  it("reads what is stored: price, stock at the default location, preorder off, its own parcel", () => {
    expect(read(a)).toMatchObject({
      price: "249,00",
      stock: "4",
      backorder: false,
      cost: "",
      sku: "",
      gtin: "",
      mpn: "",
      weight: "300",
      length: "",
      applyAll: false,
    })
    expect(read(b).stock).toBe("0")
  })

  it("reads the product's pictures in their order, tied to this variant or not, with alt texts", () => {
    expect(imagesFor(PRODUCT, "a")).toEqual([
      {
        key: "img_1",
        url: "https://cdn/1.jpg",
        imageId: "img_1",
        mediaId: "media_1",
        alt: "Önden",
        tied: false,
      },
      {
        key: "img_2",
        url: "https://cdn/2.jpg",
        imageId: "img_2",
        mediaId: "media_2",
        alt: "",
        tied: true,
      },
      // An old picture added by address: no record to keep an alt text in
      {
        key: "img_3",
        url: "https://cdn/3.jpg",
        imageId: "img_3",
        mediaId: null,
        alt: "",
        tied: false,
      },
    ])
    // A product of one variant: the card leaves the pictures to the gallery
    expect(savedVariant(PRODUCT, a, null, undefined, false).images).toEqual([])
  })

  it("sends only what was changed, a new level where there is none", () => {
    const saved = read(b)
    const edit = variantEdit(
      b,
      { ...saved, price: "299,90", stock: "7" },
      { price: true, stock: true },
      "sloc_1"
    )
    expect(edit).toMatchObject({
      variantId: "b",
      amount: 299.9,
      stock: { inventoryItemId: "iitem_b", quantity: 7, hasLevel: false },
      backorder: null,
      codes: null,
      measures: null,
    })
    expect(variantEdit(b, saved, undefined, "sloc_1")).toBeNull()
    expect(
      variantEdit(a, { ...read(a), backorder: true }, { backorder: true }, "sloc_1")
    ).toMatchObject({ amount: null, stock: null, backorder: true })
  })

  it("sends a unit cost only when it changed, an emptied one as cleared", () => {
    expect(read(a, "sloc_1", 120.5).cost).toBe("120,50")
    expect(variantEdit(a, { ...read(a), cost: "" }, { cost: true }, "sloc_1")).toMatchObject({
      cost: null,
      amount: null,
    })
    expect(variantEdit(b, { ...read(b), cost: "88,90" }, { cost: true }, "sloc_1")).toMatchObject({
      cost: 88.9,
    })
    expect(variantEdit(a, read(a), { price: true }, "sloc_1")).not.toHaveProperty("cost")
  })

  it("sends its own parcel measures that changed, an emptied one as cleared", () => {
    const edit = variantEdit(
      a,
      { ...read(a), weight: "", length: "12,5" },
      { weight: true, length: true },
      null
    )
    expect(edit?.measures).toEqual({ weight: null, length: 12.5 })
  })

  it("writes no stock without a default location", () => {
    const edit = variantEdit(a, read(a, null), { stock: true, price: true }, null)
    expect(edit).toMatchObject({ stock: null, amount: 249 })
  })

  it("gives the price to another variant only when it differs (Tüm varyantlara uygula)", () => {
    expect(priceEdit(b, 249)).toBeNull()
    expect(priceEdit(b, 275)).toMatchObject({ variantId: "b", amount: 275, stock: null })
  })
})

describe("a variant's pictures", () => {
  const image = (key: string, tied: boolean): VariantImage => ({
    key,
    url: `https://cdn/${key}.jpg`,
    imageId: key,
    mediaId: null,
    alt: "",
    tied,
  })

  it("moves one of its own pictures past the next, the gallery's others staying where they are", () => {
    const images = [image("1", true), image("2", false), image("3", true), image("4", true)]
    expect(moveTied(images, "1", 1).map((each) => each.key)).toEqual(["3", "2", "1", "4"])
    expect(moveTied(images, "4", -1).map((each) => each.key)).toEqual(["1", "2", "4", "3"])
    // Already first: nothing moves
    expect(moveTied(images, "1", -1).map((each) => each.key)).toEqual(["1", "2", "3", "4"])
  })
})

describe("variant codes", () => {
  it("reads the barcode from the field structured data uses, else from the EAN", () => {
    const upc = variant("a", [], { upc: "036000291452", barcode: "RAF-25" })
    const inHouse = variant("b", [], { barcode: "RAF-25" })
    const typo = variant("c", [], { ean: "4006381333932" })

    expect(gtinField(upc)).toBe("upc")
    expect(gtinField(inHouse)).toBe("ean")
    expect(gtinField(typo)).toBe("ean")
    const codes = [
      savedVariant(PRODUCT, upc, null, undefined),
      savedVariant(PRODUCT, inHouse, null, catalogRow("b", { mpn: "RAF-25-ST" })),
      savedVariant(PRODUCT, typo, null, undefined),
    ]
    expect(codes.map(({ sku, gtin, mpn }) => ({ sku, gtin, mpn }))).toEqual([
      { sku: "", gtin: "036000291452", mpn: "" },
      { sku: "", gtin: "", mpn: "RAF-25-ST" },
      { sku: "", gtin: "4006381333932", mpn: "" },
    ])
  })

  it("sends the changed codes where they are kept: SKU and barcode to the variant, MPN to the catalog", () => {
    const a = variant("a", [], { upc: "036000291452", sku: "MYL-1" })
    const b = variant("b", [], { barcode: "RAF-25" })
    const cleared = variantEdit(
      a,
      { ...savedVariant(PRODUCT, a, null, undefined), sku: "", gtin: "" },
      { sku: true, gtin: true },
      null
    )
    const typed = variantEdit(
      b,
      {
        ...savedVariant(PRODUCT, b, null, undefined),
        sku: " MYL-2 ",
        gtin: "8 690000 000005",
        mpn: " RAF-25-ST ",
      },
      { sku: true, gtin: true, mpn: true },
      null
    )

    expect(cleared).toMatchObject({ variantId: "a", codes: { sku: null, upc: null }, amount: null })
    expect(cleared).not.toHaveProperty("mpn")
    // The in-house code in `barcode` stays; the GTIN goes to the EAN
    expect(typed).toMatchObject({
      variantId: "b",
      codes: { sku: "MYL-2", ean: "8690000000005" },
      mpn: "RAF-25-ST",
    })
  })

  const check = (saved: VariantValues, gtin: string) => {
    const result = variantSchemaFor(saved).safeParse({ ...saved, gtin })
    return result.success ? null : result.error.issues.map((issue) => issue.message)
  }

  it("refuses a typed barcode whose check digit does not fit, never an empty one", () => {
    const saved = savedVariant(PRODUCT, variant("a", []), null, undefined)

    expect(check(saved, "")).toBeNull()
    expect(check(saved, "8690000000005")).toBeNull()
    expect(check(saved, "8690000000001")).toEqual(["products.errors.gtin.check"])
    expect(check(saved, "86900")).toEqual(["products.errors.gtin.format"])
  })

  it("lets a stored code that is not a GTIN through, so a price can still be saved", () => {
    const saved = savedVariant(PRODUCT, variant("a", [], { ean: "4006381333932" }), null, undefined)

    expect(check(saved, "4006381333932")).toBeNull()
    expect(check(saved, "4006381333933")).toEqual(["products.errors.gtin.check"])
  })

  it("sends the advisor's jump to the first variant without a barcode or an MPN", () => {
    const row = (gtin: string, mpn = "") => ({ sku: "", gtin, mpn })

    expect(firstUncoded([row("8690000000005"), row("", "RAF"), row("")])).toBe(2)
    expect(firstUncoded([row("8690000000005"), row("", "RAF")])).toBe(1)
    expect(firstUncoded([row("8690000000005")])).toBe(0)
  })
})
