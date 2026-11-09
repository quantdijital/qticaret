import { describe, expect, it } from "vitest"
import type { StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { isProductPreviewToken, productPreviewView } from "../product-preview"

const MAC = "b".repeat(43)

const product: StoreProduct = {
  id: "prod_1",
  title: "Şef Bıçağı (kopya)",
  handle: "sef-bicagi-kopya",
  subtitle: null,
  description: "Paslanmaz çelik.",
  thumbnail: null,
  options: [{ id: "opt_size", title: "Boyut", values: [{ id: "optval_20", value: "20 cm" }] }],
  variants: [
    {
      id: "variant_20",
      title: "20 cm",
      sku: null,
      manage_inventory: false,
      allow_backorder: false,
      inventory_quantity: 0,
      options: [{ id: "optval_20", value: "20 cm" }],
      calculated_price: { calculated_amount: 1000, original_amount: 1000, currency_code: "try" },
    },
  ],
}

describe("a draft product's preview link (F18)", () => {
  it("takes a product's token only", () => {
    expect(isProductPreviewToken(`prod_01JABC.to51q5.${MAC}`)).toBe(true)
    expect(isProductPreviewToken(`cnt_01JABC.to51q5.${MAC}`)).toBe(false)
    expect(isProductPreviewToken(`sfl_01JABC.to51q5.${MAC}`)).toBe(false)
    expect(isProductPreviewToken(`prod_01JABC.to51q5.${MAC.slice(1)}`)).toBe(false)
    expect(isProductPreviewToken(`prod_01JABC.to51q5.${MAC}/x`)).toBe(false)
  })

  it("draws the product's own block under a preview line, without what only a live page has", () => {
    const view = productPreviewView({
      product,
      descriptionHtml: "<p>Paslanmaz <strong>çelik</strong>.</p>",
      summaryHtml: null,
      requestedVariant: null,
      trustBadges: [],
      t,
    })
    expect(view.notice).toBe(t("preview.product_notice"))
    expect(view.notice).toContain("Önizleme")
    expect(view.title).toBe("Şef Bıçağı (kopya)")
    expect(view.descriptionHtml).toBe("<p>Paslanmaz <strong>çelik</strong>.</p>")
    expect(view.variants[0]?.price?.current).toBe("1.000,00 TL")
    expect(view.selectedVariantId).toBe("variant_20")
    expect(view).toMatchObject({
      reviews: { count: 0, items: [] },
      questions: { count: 0, items: [] },
      related: [],
      sections: [],
      whatsappHref: null,
      shippingNote: null,
    })
  })
})
