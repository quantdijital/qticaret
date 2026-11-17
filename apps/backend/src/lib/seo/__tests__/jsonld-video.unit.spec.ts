import { z } from "@medusajs/framework/zod"
import { productJsonLd } from "../jsonld"
import type { ProductFacts, VariantFacts } from "../jsonld"
import { isoDuration } from "../jsonld-video"
import type { VideoFacts } from "../jsonld-video"
import { resolveSeoPayload } from "../resolve"

const variant = (overrides: Partial<VariantFacts> = {}): VariantFacts => ({
  id: "variant_01",
  name: "Keten Gömlek – M",
  sku: "GMLK-M",
  gtin: "8690000000012",
  mpn: null,
  image: null,
  price: 899,
  availability: "InStock",
  properties: { size: "M" },
  ...overrides,
})

const facts = (overrides: Partial<ProductFacts> = {}): ProductFacts => ({
  name: "Keten Gömlek",
  description: "Yıkanmış ketenden rahat kesim gömlek.",
  images: ["https://cdn.example.com/gomlek.webp"],
  brand: "Örnek Marka",
  condition: "new",
  groupId: "keten-gomlek",
  variesBy: ["size"],
  variants: [variant()],
  ...overrides,
})

const group = (overrides: Partial<ProductFacts> = {}) =>
  facts({
    variants: [
      variant(),
      variant({
        id: "variant_02",
        name: "Keten Gömlek – L",
        sku: "GMLK-L",
        properties: { size: "L" },
      }),
    ],
    ...overrides,
  })

const URL = "https://magaza.example.com/urun/keten-gomlek"
const META = "Keten gömlek, hızlı kargo ile."

const clip = (overrides: Partial<Extract<VideoFacts, { kind: "upload" }>> = {}): VideoFacts => ({
  kind: "upload",
  id: "mvid_01",
  title: "Yakın çekim",
  thumbnails: [
    "https://cdn.example.com/gomlek-video-1-1280.webp",
    "https://cdn.example.com/gomlek-video-1-og.jpg",
  ],
  uploadDate: "2026-11-17T09:30:00.000Z",
  contentUrl: "https://cdn.example.com/gomlek-video-1.mp4",
  durationMs: 12_400,
  ...overrides,
})

const youtube = (
  overrides: Partial<Extract<VideoFacts, { kind: "youtube" }>> = {}
): VideoFacts => ({
  kind: "youtube",
  id: "mvid_02",
  title: null,
  thumbnails: ["https://cdn.example.com/gomlek-video-2-1280.webp"],
  uploadDate: "2026-11-17T10:00:00.000Z",
  youtubeId: "dQw4w9WgXcQ",
  ...overrides,
})

// Google's required fields (name, thumbnailUrl, uploadDate) and what it reads to play the video
const videoNode = z
  .object({
    "@type": z.literal("VideoObject"),
    "@id": z.string().startsWith(`${URL}#video-`),
    name: z.string().min(1),
    description: z.string().min(1),
    thumbnailUrl: z.array(z.url()).min(1),
    uploadDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/),
    duration: z
      .string()
      .regex(/^PT\d+S$/)
      .optional(),
    contentUrl: z.url().optional(),
    embedUrl: z.url().optional(),
  })
  .strict()

const graphOf = (block: Record<string, unknown>) => {
  expect(block["@context"]).toBe("https://schema.org")
  return block["@graph"] as Record<string, unknown>[]
}

// The blocks as they were printed before videos (adr/0069 §9): a video-less product's stay byte for byte
const SINGLE_BEFORE =
  '{"@type":"Product","@context":"https://schema.org","name":"Keten Gömlek","description":"Yıkanmış ketenden rahat kesim gömlek.","sku":"GMLK-M","gtin":"8690000000012","image":["https://cdn.example.com/gomlek.webp"],"brand":{"@type":"Brand","name":"Örnek Marka"},"size":"M","offers":{"@type":"Offer","url":"https://magaza.example.com/urun/keten-gomlek","price":"899.00","priceCurrency":"TRY","availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}}'
const GROUP_BEFORE =
  '{"@context":"https://schema.org","@type":"ProductGroup","name":"Keten Gömlek","description":"Yıkanmış ketenden rahat kesim gömlek.","image":["https://cdn.example.com/gomlek.webp"],"brand":{"@type":"Brand","name":"Örnek Marka"},"productGroupID":"keten-gomlek","variesBy":["https://schema.org/size"],"hasVariant":[{"@type":"Product","name":"Keten Gömlek – M","sku":"GMLK-M","gtin":"8690000000012","image":["https://cdn.example.com/gomlek.webp"],"size":"M","offers":{"@type":"Offer","url":"https://magaza.example.com/urun/keten-gomlek?variant=variant_01","price":"899.00","priceCurrency":"TRY","availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}},{"@type":"Product","name":"Keten Gömlek – L","sku":"GMLK-L","gtin":"8690000000012","image":["https://cdn.example.com/gomlek.webp"],"size":"L","offers":{"@type":"Offer","url":"https://magaza.example.com/urun/keten-gomlek?variant=variant_02","price":"899.00","priceCurrency":"TRY","availability":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition"}}]}'

describe("a product without videos", () => {
  it("prints the same bytes as before videos", () => {
    expect(JSON.stringify(productJsonLd(facts(), URL, META))).toBe(SINGLE_BEFORE)
    expect(JSON.stringify(productJsonLd(group(), URL, META))).toBe(GROUP_BEFORE)
    expect(JSON.stringify(productJsonLd(facts({ videos: [] }), URL, META))).toBe(SINGLE_BEFORE)
    expect(JSON.stringify(productJsonLd(group({ videos: [] }), URL, META))).toBe(GROUP_BEFORE)
    expect(JSON.stringify(productJsonLd(facts(), URL))).toBe(SINGLE_BEFORE)
  })

  it("prints the same bytes when no video can be written", () => {
    const broken = [clip({ uploadDate: null }), youtube({ thumbnails: [] })]
    expect(JSON.stringify(productJsonLd(facts({ videos: broken }), URL, META))).toBe(SINGLE_BEFORE)
  })
})

describe("productJsonLd's videos (adr/0069 §9)", () => {
  it("writes an uploaded clip with its MP4, duration and the page's meta description", () => {
    const [product, video] = graphOf(productJsonLd(facts({ videos: [clip()] }), URL, META))
    expect(videoNode.parse(video)).toEqual({
      "@type": "VideoObject",
      "@id": `${URL}#video-mvid_01`,
      name: "Yakın çekim",
      description: META,
      thumbnailUrl: [
        "https://cdn.example.com/gomlek-video-1-1280.webp",
        "https://cdn.example.com/gomlek-video-1-og.jpg",
      ],
      uploadDate: "2026-11-17T09:30:00.000Z",
      duration: "PT12S",
      contentUrl: "https://cdn.example.com/gomlek-video-1.mp4",
    })
    expect(product).toMatchObject({
      "@type": "Product",
      subjectOf: { "@id": `${URL}#video-mvid_01` },
    })
  })

  it("writes a YouTube video with Google's embed address, the product's name and no duration", () => {
    const [, video] = graphOf(productJsonLd(facts({ videos: [youtube()] }), URL, META))
    expect(videoNode.parse(video)).toMatchObject({
      name: "Keten Gömlek",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    })
    expect(video).not.toHaveProperty("duration")
    expect(video).not.toHaveProperty("contentUrl")
  })

  it("links the product to its videos in subjectOf, the product's own node without its context", () => {
    const block = productJsonLd(group({ videos: [clip(), youtube()] }), URL, META)
    const [product, ...videos] = graphOf(block)
    expect(product).not.toHaveProperty("@context")
    expect(product).toMatchObject({ "@type": "ProductGroup", productGroupID: "keten-gomlek" })
    expect(product?.["subjectOf"]).toEqual([
      { "@id": `${URL}#video-mvid_01` },
      { "@id": `${URL}#video-mvid_02` },
    ])
    expect(videos.map((video) => video["@id"])).toEqual([
      `${URL}#video-mvid_01`,
      `${URL}#video-mvid_02`,
    ])
  })

  it("falls back to the product's description, then its name, so a description is never empty", () => {
    const [, own] = graphOf(productJsonLd(facts({ videos: [clip()] }), URL, "  "))
    expect(own?.["description"]).toBe("Yıkanmış ketenden rahat kesim gömlek.")
    const [, named] = graphOf(productJsonLd(facts({ description: "", videos: [clip()] }), URL))
    expect(named?.["description"]).toBe("Keten Gömlek")
  })

  it("leaves out a video missing a required field or anything to play", () => {
    const missing: VideoFacts[] = [
      clip({ id: "no_date", uploadDate: null }),
      clip({ id: "no_thumb", thumbnails: [] }),
      clip({ id: "no_mp4", contentUrl: null }),
      youtube({ id: "bad_id", youtubeId: "javascript:" }),
      clip({ id: "kept" }),
    ]
    const [product, ...videos] = graphOf(productJsonLd(facts({ videos: missing }), URL, META))
    expect(videos.map((video) => video["@id"])).toEqual([`${URL}#video-kept`])
    expect(product?.["subjectOf"]).toEqual({ "@id": `${URL}#video-kept` })
    const nameless = productJsonLd(facts({ name: " ", videos: [clip({ title: null })] }), URL, META)
    expect(nameless).not.toHaveProperty("@graph")
  })

  it("writes at most the two videos a page shows", () => {
    const three = [clip({ id: "a" }), clip({ id: "b" }), youtube({ id: "c" })]
    const [, ...videos] = graphOf(productJsonLd(facts({ videos: three }), URL, META))
    expect(videos).toHaveLength(2)
  })
})

describe("a product page's seo object with a video", () => {
  it("describes the video with the page's own meta description", () => {
    const seo = resolveSeoPayload(
      {
        kind: "product",
        path: "/urun/keten-gomlek",
        name: "Keten Gömlek",
        description: "Yıkanmış ketenden rahat kesim gömlek.",
        tokens: {},
        overrides: {
          seo_title: null,
          seo_description: "Yaz için keten.",
          canonical_override: null,
          robots_override: null,
          og_image_alt: null,
        },
        image: null,
        trail: [],
        product: facts({ videos: [clip()] }),
      },
      {
        name: "Mağaza",
        canonicalHost: "magaza.example.com",
        indexing: true,
        titleTemplates: {
          product: "{ürün_adı}",
          category: "{kategori}",
          brand: "{marka}",
          page: "{başlık}",
          post: "{başlık}",
          landing: "{başlık}",
        },
        descriptionTemplates: { product: "" },
      }
    )
    const [, video] = graphOf(seo.jsonLd[0] ?? {})
    expect(video).toMatchObject({ "@id": `${URL}#video-mvid_01`, description: "Yaz için keten." })
  })
})

describe("isoDuration", () => {
  it("rounds to whole seconds, at least one, and writes none when unknown", () => {
    expect(isoDuration(12_400)).toBe("PT12S")
    expect(isoDuration(12_500)).toBe("PT13S")
    expect(isoDuration(30_000)).toBe("PT30S")
    expect(isoDuration(200)).toBe("PT1S")
    expect(isoDuration(0)).toBeUndefined()
    expect(isoDuration(null)).toBeUndefined()
    expect(isoDuration(Number.NaN)).toBeUndefined()
  })
})
