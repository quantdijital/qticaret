import path from "node:path"
import { imagesOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { imageUrls } from "../../../workflows/storefront/layout-read"
import { layoutDocument, readStoredLayout } from "../layout"
import { RICH_TEXT_IMAGE_SIDES } from "../sections/rich-text"

// The text's cards and pictures' sizes are the store's: none here
jest.mock("../../../api/store/content/cards", () => ({
  cardTargets: () =>
    Promise.resolve({ product: new Map(), category: new Map(), images: new Map() }),
}))

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-rich-text.ts"
)

const PHOTO = { url: "http://localhost:9000/static/atolye.webp", alt: "Atölyede bileme" }
const INLINE = "http://localhost:9000/static/tezgah.webp"
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hikâyemiz" }] }],
}
const story = (more: Record<string, unknown> = {}) => ({
  id: "hikaye01",
  type: "rich_text",
  title: "Hakkımızda",
  body,
  ...more,
})
const pictured = (more: Record<string, unknown> = {}) =>
  story({ variant: "with_image", image: PHOTO, ...more })
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []
const PAGE = "cnt_hakkimizda"

describe("the rich text's variants (adr/0073 §3, Görselli metin)", () => {
  it("reads a rich text saved before variants as today's pane, on every page and in the footer", () => {
    const doc = layoutDocument.parse({
      home: [story()],
      category: [story({ id: "kathikaye1" })],
      footer: [story({ id: "althikaye1" })],
    })

    expect(doc.home).toEqual([{ ...story(), ...ALWAYS, variant: "pane" }])
    expect(doc.category[0]).toMatchObject({ variant: "pane", placement: "bottom" })
    expect(doc.footer[0]).toMatchObject({ variant: "pane" })
    // A stored one reads the same, no "unsaved changes"
    expect(readStoredLayout({ home: [story()] }).home[0]).toMatchObject({ variant: "pane" })
  })

  it("takes the picture beside the text on the home, product, category and content pages", () => {
    const doc = layoutDocument.parse({
      home: [pictured()],
      product: [pictured({ id: "urunhikaye", image_side: "end" })],
      category: [pictured({ id: "kathikaye1", placement: "top" })],
      pages: [{ page_id: PAGE, sections: [pictured({ id: "sayfahikay" })] }],
    })

    expect(doc.home[0]).toMatchObject({ variant: "with_image", image: PHOTO, image_side: "start" })
    expect(doc.product[0]).toMatchObject({ image_side: "end" })
    expect(doc.category[0]).toMatchObject({ variant: "with_image", placement: "top" })
    expect(doc.pages[0]?.sections[0]).toMatchObject({ variant: "with_image", image: PHOTO })
  })

  it("refuses the picture variant without its picture, with a side off its list or on the pane", () => {
    expect(issues({ home: [story({ variant: "with_image" })] }).length).toBeGreaterThan(0)
    expect(issues({ home: [pictured({ image: null })] }).length).toBeGreaterThan(0)
    expect(issues({ home: [pictured({ image_side: "left" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [story({ variant: "collage" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ home: [story({ image: PHOTO })] }).length).toBeGreaterThan(0)
  })

  it("keeps the footer group's rich text to the pane (adr/0070 §4)", () => {
    expect(issues({ footer: [pictured({ id: "althikaye1" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ footer: [story({ id: "althikaye1", variant: "pane" })] })).toEqual([])
  })

  it("reads a stored variant off the list as the pane, the title and text kept", () => {
    const doc = readStoredLayout({
      home: [story({ ...ALWAYS, variant: "removed_one", image: PHOTO, image_side: "end" })],
    })

    expect(doc.home[0]).toEqual({ ...story(), ...ALWAYS, variant: "pane" })
  })

  it("names the picture beside the text for the media library check and the sizes", () => {
    const doc = layoutDocument.parse({
      home: [
        pictured({
          body: { type: "doc", content: [{ type: "image", attrs: { src: INLINE, alt: null } }] },
        }),
        story({ id: "duzhikaye" }),
      ],
    })
    const [withImage, pane] = doc.home

    expect(withImage && imagesOf(withImage)).toEqual([INLINE, PHOTO.url])
    // The text's own pictures are sized by its renderer, not with the design's
    expect(withImage && imageUrls(withImage)).toEqual([PHOTO.url])
    expect(pane && imageUrls(pane)).toEqual([])
  })

  it("prints the pane as before variants, the picture variant with its picture and side", async () => {
    const doc = layoutDocument.parse({
      home: [story(), pictured({ id: "resimli01", image: { ...PHOTO, alt: null } })],
    })
    const [pane, withImage] = doc.home
    const known = { url: PHOTO.url, alt: "Kütüphanedeki ad", width: 1200, height: 900 }
    const at = {
      values: {},
      links: new Map(),
      images: new Map([[PHOTO.url, { ...known, derivatives: null }]]),
    } as unknown as HydrateContext

    expect(pane && (await hydrateSection(pane, at))).toEqual({
      id: "hikaye01",
      type: "rich_text",
      title: "Hakkımızda",
      html: "<p>Hikâyemiz</p>",
    })
    // No alt of its own: the media library's
    expect(withImage && (await hydrateSection(withImage, at))).toEqual({
      id: "resimli01",
      type: "rich_text",
      title: "Hakkımızda",
      html: "<p>Hikâyemiz</p>",
      variant: "with_image",
      image: { ...known, derivatives: null },
      image_side: "start",
    })
  })

  it("mirrors the contract's sides: a side goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(RICH_TEXT_IMAGE_SIDES).toEqual(contract["RICH_TEXT_IMAGE_SIDES"])
  })
})
