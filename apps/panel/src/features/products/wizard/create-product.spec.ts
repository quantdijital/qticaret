import { describe, expect, it, vi } from "vitest"
import { EMPTY_SUMMARY } from "@/features/products/summary-doc"
import { catalogBody, productBody } from "./create-product"
import { BLANK_VARIANT, defaultWizardValues } from "./schema"
import type { WizardValues } from "./schema"

vi.mock("@/lib/sdk", () => ({ sdk: {} }))

const written = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

describe("catalogBody", () => {
  it("asks nothing of a physical product without a short description", () => {
    expect(catalogBody({ kind: "physical", summary_doc: EMPTY_SUMMARY })).toBeNull()
    // The editor's empty paragraph, or spaces, say nothing
    const blank = { type: "doc", content: [{ type: "paragraph" }] }
    expect(catalogBody({ kind: "physical", summary_doc: blank })).toBeNull()
    expect(catalogBody({ kind: "physical", summary_doc: written("  ") })).toBeNull()
  })

  it("sends a physical product's short description alone, as written", () => {
    const doc = written("Yıkanmış keten, rahat kesim.")
    expect(catalogBody({ kind: "physical", summary_doc: doc })).toEqual({ summary_doc: doc })
  })

  // F3.2: the kind goes before the product is published; the short description in the same save
  it("sends a digital product's kind and short description in one save", () => {
    expect(catalogBody({ kind: "digital", summary_doc: EMPTY_SUMMARY })).toEqual({
      kind: "digital",
    })
    const doc = written("Bir saatlik görüşme.")
    expect(catalogBody({ kind: "service", summary_doc: doc })).toEqual({
      kind: "service",
      summary_doc: doc,
    })
  })
})

const PURPLE = "https://cdn/mor.jpg"
const GREEN = "https://cdn/yesil.jpg"

const knife = (): WizardValues => ({
  ...defaultWizardValues(),
  title: "Şef Bıçağı",
  has_options: true,
  options: [{ title: "Renk", values: ["Mor", "Yeşil"] }],
  images: [
    { id: "file_1", url: "https://cdn/genel.jpg" },
    { id: "file_2", url: PURPLE },
    { id: "file_3", url: GREEN },
  ],
  weight: "500",
  variants: ["Mor", "Yeşil"].map((colour) => ({
    ...BLANK_VARIANT,
    key: colour,
    title: colour,
    options: { Renk: colour },
    price: "1.250,00",
  })),
})

const input = (values: WizardValues) => ({
  values,
  publish: false,
  defaults: { salesChannelId: null, locationId: null, shippingProfileId: null },
  defaultOption: { title: "Seçenek", value: "Standart" },
})

describe("productBody", () => {
  it("sends the variant pictures picked before saving, by option values and address", () => {
    const values = knife()
    values.variants = values.variants.map((row) =>
      row.key === "Mor"
        ? { ...row, image_urls: [PURPLE] }
        : // A picture taken out of the gallery after it was picked is not sent
          { ...row, image_urls: ["https://cdn/silindi.jpg", GREEN, PURPLE] }
    )
    expect(productBody(input(values)).additional_data).toEqual({
      variant_images: [
        { options: { Renk: "Mor" }, image_urls: [PURPLE] },
        // In the gallery's order
        { options: { Renk: "Yeşil" }, image_urls: [PURPLE, GREEN] },
      ],
    })
  })

  it("sends no additional data when no variant has pictures of its own", () => {
    expect(productBody(input(knife()))).not.toHaveProperty("additional_data")
  })

  it("sends a variant's own parcel beside the product's", () => {
    const values = knife()
    values.variants = values.variants.map((row) =>
      row.key === "Mor" ? { ...row, weight: "350", height: "4,5" } : row
    )
    const body = productBody(input(values))
    expect(body).toMatchObject({ weight: 500 })
    expect(body.variants[0]).toMatchObject({ weight: 350, height: 4.5 })
    expect(body.variants[1]).not.toHaveProperty("weight")
  })
})

describe("catalogBody with variants", () => {
  it("sends unit costs and MPNs by the saved variants' ids", () => {
    const values = knife()
    values.variants = values.variants.map((row) =>
      row.key === "Mor" ? { ...row, cost: "400,50", mpn: " SB-MOR " } : row
    )
    expect(catalogBody(values, ["variant_mor", "variant_yesil"])).toEqual({
      variants: { variant_mor: { cost: 400.5, mpn: "SB-MOR" } },
    })
    // A variant the save did not answer for is left to its page
    expect(catalogBody(values, [undefined, "variant_yesil"])).toBeNull()
  })
})
