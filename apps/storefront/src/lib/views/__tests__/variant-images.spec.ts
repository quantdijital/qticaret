import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { productImages, variantImages } from "../image"
import { productPage } from "../product"

/**
 * A variant's own pictures (owner 2026-11-05: "choosing another colour
 * does not show its photo"): Medusa's variant images, as places in the
 * page's pictures, and the variant `?variant=` asked for when it has some.
 */

const variant = (id: string, colour: string) => ({
  id,
  title: colour,
  sku: null,
  manage_inventory: false,
  allow_backorder: false,
  options: [{ id: `optval_${id}`, value: colour, option_id: "opt_renk" }],
  calculated_price: { calculated_amount: 1000, original_amount: 1000, currency_code: "try" },
})

const product: StoreProduct = {
  id: "prod_set",
  title: "Renkli Set",
  handle: "renkli-set",
  subtitle: null,
  description: null,
  thumbnail: null,
  // Out of rank order on purpose: places follow the ranks
  images: [
    {
      id: "img_yesil",
      url: "https://cdn.example.com/yesil.webp",
      rank: 2,
      variants: [{ id: "variant_yesil" }],
    },
    { id: "img_set", url: "https://cdn.example.com/set.webp", rank: 0, variants: [] },
    {
      id: "img_kirmizi",
      url: "https://cdn.example.com/kirmizi.webp",
      rank: 1,
      variants: [{ id: "variant_kirmizi" }, null],
    },
    { id: "img_yakin", url: "https://cdn.example.com/yakin.webp", rank: 3 },
  ],
  options: [
    {
      id: "opt_renk",
      title: "Renk",
      values: [
        { id: "optval_variant_kirmizi", value: "Kırmızı" },
        { id: "optval_variant_yesil", value: "Yeşil" },
        { id: "optval_variant_mavi", value: "Mavi" },
      ],
    },
  ],
  variants: [
    variant("variant_kirmizi", "Kırmızı"),
    variant("variant_yesil", "Yeşil"),
    variant("variant_mavi", "Mavi"),
  ],
}

const page = (requestedVariant: string | null) =>
  productPage({
    product,
    seo: null,
    displays: {},
    brandPath: null,
    requestedVariant,
    t,
    trustBadges: [],
  })

describe("variantImages", () => {
  it("gives each variant its own pictures' places in the page's ranked pictures", () => {
    expect(productImages(product).map((image) => image.src.split("/").pop())).toEqual([
      "set.webp",
      "kirmizi.webp",
      "yesil.webp",
      "yakin.webp",
    ])
    expect(Object.fromEntries(variantImages(product))).toEqual({
      variant_kirmizi: [1],
      variant_yesil: [2],
    })
  })
})

describe("productPage: the variants' pictures", () => {
  it("names them on the variants that have some, none on the others", () => {
    const view = page(null)
    expect(view.variants.map((each) => [each.id, each.images ?? null])).toEqual([
      ["variant_kirmizi", [1]],
      ["variant_yesil", [2]],
      ["variant_mavi", null],
    ])
    // Nothing asked: the gallery opens on the product's own order
    expect(view.galleryVariantId).toBeNull()
  })

  it("opens the gallery on the variant ?variant= asked for, when it has pictures of its own", () => {
    expect(page("variant_yesil").galleryVariantId).toBe("variant_yesil")
    expect(page("variant_mavi").galleryVariantId).toBeNull()
    expect(page("variant_yok").galleryVariantId).toBeNull()
  })
})
