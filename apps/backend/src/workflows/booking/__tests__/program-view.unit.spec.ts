import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Program } from "../../../lib/booking/program"
import { MEDIA_MODULE } from "../../../modules/media"
import { checkProgramImages } from "../program"
import { readProgram, storeProductProgram } from "../program-view"

// adr/0078: a dated product's program as the panel and the storefront read it
const CDN = "https://cdn.example.com"

const program = {
  unit: "day",
  steps: [
    {
      title: "Göreme",
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Vadiler <b>" }] }],
      },
      image: { url: `${CDN}/goreme.webp`, alt: null },
      tags: ["dinner", "breakfast"],
    },
    { label: "Son gün", title: "Dönüş", image: { url: `${CDN}/silindi.webp`, alt: "Yol" } },
  ],
}

interface Row {
  id: string
  status?: string
  sales_channels?: { id: string }[]
  product_extension?: { booking_mode: string } | null
  bookable?: { program: unknown } | null
}

const tour = (extra: Partial<Row> = {}): Row => ({
  id: "prod_1",
  status: "published",
  sales_channels: [{ id: "sc_1" }],
  product_extension: { booking_mode: "departure" },
  bookable: { program },
  ...extra,
})

interface Asset {
  url: string
  alt?: string | null
  width?: number | null
  height?: number | null
  derivatives?: unknown
  mime_type?: string | null
  file_id?: string | null
}

/** A container whose query answers `row` and whose media library holds `assets`. */
function containerWith(row: Row | undefined, assets: Asset[] = []) {
  const listMediaAssets = jest.fn((filters: Record<string, unknown>) => {
    const urls = filters["url"] as string[]
    const matching = assets.filter((asset) => urls.includes(asset.url))
    if (filters["mime_type"]) {
      return Promise.resolve(matching.filter((asset) => asset.mime_type === filters["mime_type"]))
    }
    if (filters["file_id"]) {
      return Promise.resolve(matching.filter((asset) => asset.file_id))
    }
    return Promise.resolve(matching)
  })
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.QUERY]: {
      graph: () => Promise.resolve({ data: row ? [row] : [] }),
    },
    [MEDIA_MODULE]: { listMediaAssets },
  }
  return { container: { resolve: (key: string) => services[key] } as never, listMediaAssets }
}

const goreme: Asset = {
  url: `${CDN}/goreme.webp`,
  alt: "Peri bacaları",
  width: 1600,
  height: 900,
  derivatives: { webp: [] },
  mime_type: "image/webp",
  file_id: "file_1",
}

describe("storeProductProgram", () => {
  it("renders each step's body escaped, its picture from the library, a removed one left out", async () => {
    const { container } = containerWith(tour(), [goreme])
    const answer = await storeProductProgram(container, "prod_1", ["sc_1"])
    expect(answer?.unit).toBe("day")
    const [first, last] = answer?.steps ?? []
    expect(first).toMatchObject({
      label: null,
      title: "Göreme",
      image: { url: goreme.url, alt: "Peri bacaları", width: 1600, height: 900 },
      tags: ["breakfast", "dinner"],
    })
    expect(first?.body_html).toContain("<p>")
    expect(first?.body_html).toContain("&lt;b&gt;")
    expect(first?.body_html).not.toContain("<b>")
    expect(last).toMatchObject({ label: "Son gün", body_html: null, image: null, tags: [] })
  })

  it("keeps the step's own alt text over the library's", async () => {
    const own = {
      unit: "step",
      steps: [{ title: "A", image: { url: goreme.url, alt: "Kendi metni" } }],
    }
    const { container } = containerWith(tour({ bookable: { program: own } }), [goreme])
    const answer = await storeProductProgram(container, "prod_1", ["sc_1"])
    expect(answer?.steps[0]?.image?.alt).toBe("Kendi metni")
  })

  it("reads a draft, another storefront's or an unknown product as unknown", async () => {
    for (const row of [
      tour({ status: "draft" }),
      tour({ sales_channels: [{ id: "sc_2" }] }),
      undefined,
    ]) {
      const { container } = containerWith(row)
      await expect(storeProductProgram(container, "prod_1", ["sc_1"])).rejects.toThrow(
        "catalog.product_unknown"
      )
    }
  })

  it("gives none for a product not sold by date, or one without steps, and asks no library", async () => {
    for (const row of [
      tour({ product_extension: { booking_mode: "none" } }),
      tour({ bookable: null }),
      tour({ bookable: { program: { unit: "day", steps: [] } } }),
      tour({ bookable: { program: { unit: "week", steps: [{ title: "A" }] } } }),
    ]) {
      const { container, listMediaAssets } = containerWith(row)
      await expect(storeProductProgram(container, "prod_1", ["sc_1"])).resolves.toBeNull()
      expect(listMediaAssets).not.toHaveBeenCalled()
    }
  })
})

describe("readProgram", () => {
  it("gives the panel the stored program, or none yet as no steps by day", async () => {
    const stored = await readProgram(containerWith(tour()).container, "prod_1")
    expect(stored.booking_mode).toBe("departure")
    expect(stored.program.steps).toHaveLength(2)
    const none = await readProgram(
      containerWith(tour({ product_extension: null, bookable: null })).container,
      "prod_1"
    )
    expect(none).toEqual({ booking_mode: "none", program: { unit: "day", steps: [] } })
    await expect(readProgram(containerWith(undefined).container, "prod_1")).rejects.toThrow(
      "catalog.product_unknown"
    )
  })
})

describe("checkProgramImages", () => {
  const parsed = Program.parse(program)

  it("takes pictures that are the library's image uploads", async () => {
    const silindi = { ...goreme, url: `${CDN}/silindi.webp` }
    const { container } = containerWith(tour(), [goreme, silindi])
    await expect(checkProgramImages(container, parsed)).resolves.toBeUndefined()
  })

  it("refuses an address the library does not hold as an image upload", async () => {
    const outside = { ...goreme, url: `${CDN}/silindi.webp`, file_id: null }
    const pdf = { ...goreme, url: `${CDN}/silindi.webp`, mime_type: "application/pdf" }
    for (const assets of [[goreme], [goreme, outside], [goreme, pdf]]) {
      await expect(
        checkProgramImages(containerWith(tour(), assets).container, parsed)
      ).rejects.toThrow("booking.program_image_unknown")
    }
  })

  it("refuses an SVG, by its name or as the library knows it", async () => {
    const named = Program.parse({
      unit: "day",
      steps: [{ title: "A", image: { url: `${CDN}/a.svg` } }],
    })
    await expect(checkProgramImages(containerWith(tour()).container, named)).rejects.toThrow(
      "media.svg_logo_only"
    )
    const svg = { ...goreme, mime_type: "image/svg+xml" }
    const one = Program.parse({ unit: "day", steps: [{ title: "A", image: { url: goreme.url } }] })
    await expect(checkProgramImages(containerWith(tour(), [svg]).container, one)).rejects.toThrow(
      "media.svg_logo_only"
    )
  })

  it("asks nothing of a program without pictures", async () => {
    const { container, listMediaAssets } = containerWith(tour())
    await checkProgramImages(container, Program.parse({ unit: "day", steps: [{ title: "A" }] }))
    expect(listMediaAssets).not.toHaveBeenCalled()
  })
})
