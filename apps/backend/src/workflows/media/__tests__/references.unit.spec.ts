import { MEDIA_REFERENCE_SOURCES, isReferenced, keysOf, tokensOf } from "../references"
import type { MediaReferences } from "../references"

const asset = {
  id: "media_01JABC",
  url: "https://magaza.example.com/static/kupa-mavi-01JXYZ.jpg",
  file_id: "kupa-mavi-01JXYZ.jpg",
  derivatives: {
    srcset: { webp: [{ width: 640, url: "https://cdn.example.com/kupa-mavi-640-01JQ.webp" }] },
    og: { url: "https://cdn.example.com/kupa-mavi-og-01JQ.jpg", width: 1200, height: 630 },
  },
  derivative_file_ids: ["kupa-mavi-640-01JQ.webp", "kupa-mavi-og-01JQ.jpg"],
}

const referencesFrom = (texts: string[], linked: string[] = []): MediaReferences => {
  const tokens = new Set<string>()
  for (const text of texts) {
    tokensOf(text, tokens)
  }
  return { tokens, linked: new Set(linked) }
}

describe("media references (M1)", () => {
  it("knows a picture by its id, key, file name and its versions' names", () => {
    expect(keysOf(asset).sort()).toEqual(
      [
        "media_01JABC",
        "kupa-mavi-01JXYZ.jpg",
        "kupa-mavi-640-01JQ.webp",
        "kupa-mavi-og-01JQ.jpg",
      ].sort()
    )
  })

  it("finds it inside an address, a srcset, a document, a setting or by its id", () => {
    for (const text of [
      // A product's picture by its address
      asset.url,
      // A version in a srcset, as a storefront section may hold it
      '{"srcset":"https://cdn.example.com/kupa-mavi-640-01JQ.webp 640w, other.webp 1280w"}',
      // A rich text document with the address in an attribute
      '{"type":"image","attrs":{"src":"https://magaza.example.com/static/kupa-mavi-01JXYZ.jpg?v=2"}}',
      // A brand's logo or a page's share image by its storage key
      "kupa-mavi-01JXYZ.jpg",
      // A preset's own record of the picture
      "media_01JABC",
    ]) {
      expect(isReferenced(asset, referencesFrom([text]))).toBe(true)
    }
    expect(isReferenced(asset, referencesFrom([], [asset.id]))).toBe(true)
  })

  it("calls it unused only when nothing holds any of its names", () => {
    const references = referencesFrom([
      "https://magaza.example.com/static/kupa-kirmizi-01JXYZ.jpg",
      '{"text":"kupa mavi"}',
      // A longer name that merely contains its own
      "eski-kupa-mavi-01JXYZ.jpg",
    ])
    expect(isReferenced(asset, references)).toBe(false)
  })

  it("reads every place the detail's uses name, and more", () => {
    const tables = new Set(MEDIA_REFERENCE_SOURCES.map((source) => source.table))
    for (const table of [
      "image",
      "product",
      "order_line_item",
      "brand",
      "seo_meta",
      "platform_settings_section",
      "category_image",
      "collection_extension",
      "popup",
      "content_entry",
      "landing_page",
      "bulk_message",
      "storefront_layout",
      "storefront_design",
      "product_extension",
    ]) {
      expect(tables.has(table)).toBe(true)
    }
  })
})
