import { planVariantImageTies, readVariantImages } from "../variant-images"
import type { CreatedProductShape } from "../variant-images"

const product: CreatedProductShape = {
  images: [
    { id: "img_1", url: "https://cdn.example.com/mor.jpg" },
    { id: "img_2", url: "https://cdn.example.com/yesil.jpg" },
    { id: "img_3", url: "https://cdn.example.com/genel.jpg" },
  ],
  options: [
    { id: "opt_renk", title: "Renk" },
    { id: "opt_boy", title: "Boy" },
  ],
  variants: [
    {
      id: "var_mor_18",
      options: [
        { value: "Mor", option_id: "opt_renk" },
        { value: "18 cm", option_id: "opt_boy" },
      ],
    },
    {
      id: "var_yesil_18",
      options: [
        { value: "Yeşil", option_id: "opt_renk" },
        { value: "18 cm", option_id: "opt_boy" },
      ],
    },
  ],
}

/** The key of the error a call refuses with; null when it does not. */
function refusal(call: () => unknown): string | null {
  try {
    call()
    return null
  } catch (failure) {
    return (failure as { safeMessage?: string }).safeMessage ?? "unknown"
  }
}

describe("readVariantImages", () => {
  it("reads none when none was sent", () => {
    expect(readVariantImages(undefined)).toEqual([])
    expect(readVariantImages({})).toEqual([])
    expect(readVariantImages({ brand_id: "brand_1" })).toEqual([])
  })

  it("refuses a malformed list (a workflow called directly)", () => {
    expect(
      refusal(() => readVariantImages({ variant_images: [{ options: {}, image_urls: [] }] }))
    ).toBe("catalog.variant_images_invalid")
    expect(refusal(() => readVariantImages({ variant_images: "x" }))).toBe(
      "catalog.variant_images_invalid"
    )
  })
})

describe("planVariantImageTies", () => {
  it("ties each picture to the variant its option values name, in any order", () => {
    const ties = planVariantImageTies(product, [
      {
        options: { Boy: "18 cm", Renk: "Mor" },
        image_urls: ["https://cdn.example.com/mor.jpg"],
      },
      {
        // Spaces around a value or a title name the same variant
        options: { " Renk ": "Yeşil ", Boy: "18 cm" },
        image_urls: ["https://cdn.example.com/yesil.jpg", "https://cdn.example.com/mor.jpg"],
      },
    ])
    expect(ties).toEqual([
      { image_id: "img_1", variant_id: "var_mor_18" },
      { image_id: "img_2", variant_id: "var_yesil_18" },
      { image_id: "img_1", variant_id: "var_yesil_18" },
    ])
  })

  it("ties a picture once, even named twice", () => {
    const url = "https://cdn.example.com/mor.jpg"
    expect(
      planVariantImageTies(product, [
        { options: { Renk: "Mor", Boy: "18 cm" }, image_urls: [url, url] },
      ])
    ).toEqual([{ image_id: "img_1", variant_id: "var_mor_18" }])
  })

  it("refuses a variant the product does not have", () => {
    const url = "https://cdn.example.com/mor.jpg"
    expect(
      refusal(() =>
        planVariantImageTies(product, [
          { options: { Renk: "Kırmızı", Boy: "18 cm" }, image_urls: [url] },
        ])
      )
    ).toBe("catalog.variant_image_variant_unknown")
    // Some of its values only: not a variant
    expect(
      refusal(() =>
        planVariantImageTies(product, [{ options: { Renk: "Mor" }, image_urls: [url] }])
      )
    ).toBe("catalog.variant_image_variant_unknown")
  })

  it("refuses a picture the product does not have", () => {
    expect(
      refusal(() =>
        planVariantImageTies(product, [
          {
            options: { Renk: "Mor", Boy: "18 cm" },
            image_urls: ["https://evil.example.com/x.jpg"],
          },
        ])
      )
    ).toBe("catalog.variant_image_unknown")
  })
})
