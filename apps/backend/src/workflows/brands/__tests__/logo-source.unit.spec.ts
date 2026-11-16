import type { MedusaContainer } from "@medusajs/framework/types"
import { isValidationError } from "../../../lib/errors"
import { SVG_MIME } from "../../../lib/media/svg"
import { BRANDS_MODULE } from "../../../modules/brands"
import type { BrandRecord } from "../../../modules/brands/service"
import { MEDIA_MODULE } from "../../../modules/media"
import { brandFields } from "../rules"

const measure = jest.fn()
jest.mock("../logo-size", () => ({
  measureLogo: (...args: unknown[]) => measure(...args) as unknown,
}))
jest.mock("../../files/public-upload", () => ({
  publicUploadUrl: (_container: unknown, fileId: string) =>
    Promise.resolve(fileId.startsWith("kayip") ? null : `https://cdn/${fileId}`),
}))

interface Asset {
  id: string
  file_id: string
  url: string
  mime_type: string | null
}

const listMediaAssets = jest.fn()

/** The media library holding `assets`; no other brand to clash with. */
function containerWith(assets: Asset[]): MedusaContainer {
  listMediaAssets.mockImplementation(
    (filters: { file_id?: unknown; url?: unknown; mime_type?: unknown }) => {
      if (typeof filters.file_id === "string") {
        return Promise.resolve(assets.filter((asset) => asset.file_id === filters.file_id))
      }
      // The SVG check: records at these addresses typed SVG
      const urls = filters.url as string[]
      return Promise.resolve(
        assets.filter((asset) => urls.includes(asset.url) && asset.mime_type === filters.mime_type)
      )
    }
  )
  const services: Record<string, unknown> = {
    [MEDIA_MODULE]: { listMediaAssets },
    [BRANDS_MODULE]: { listBrands: () => Promise.resolve([]) },
  }
  return { resolve: (key: string) => services[key] } as unknown as MedusaContainer
}

const image = (fileId: string, mime: string | null = "image/png"): Asset => ({
  id: `media_${fileId}`,
  file_id: fileId,
  url: `https://cdn/${fileId}`,
  mime_type: mime,
})

async function refusal(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "thrown"
  }
}

const legacy = {
  id: "brand_1",
  name: "Eski Marka",
  handle: "eski-marka",
  description: null,
  logo_file_id: "faturalar/eski.pdf",
  logo_url: "https://cdn/faturalar/eski.pdf",
  logo_width: null,
  logo_height: null,
  is_active: true,
} as unknown as BrandRecord

beforeEach(() => {
  jest.clearAllMocks()
  measure.mockResolvedValue({ width: 300, height: 100 })
})

describe("a brand logo is an image in the media library (marka logosu kaynağı)", () => {
  it("takes a library image, its address and size from the server", async () => {
    const container = containerWith([image("logo-01.png")])
    const fields = await brandFields(
      container,
      { name: "Örnek", logo_file_id: "logo-01.png" },
      null
    )
    expect(fields).toMatchObject({
      logo_file_id: "logo-01.png",
      logo_url: "https://cdn/logo-01.png",
      logo_width: 300,
      logo_height: 100,
    })
  })

  it("refuses any other stored file, even when its key is known", async () => {
    const container = containerWith([image("logo-01.png")])
    for (const key of ["faturalar/fatura-01.pdf", "etiketler/kargo-01.png", "kayip-01.png"]) {
      expect(
        await refusal(brandFields(container, { name: "Örnek", logo_file_id: key }, null))
      ).toBe("brands.logo_unknown")
    }
    expect(measure).not.toHaveBeenCalled()
  })

  it("refuses a library record that is no image", async () => {
    const container = containerWith([image("not-01.pdf", "application/pdf")])
    expect(
      await refusal(brandFields(container, { name: "Örnek", logo_file_id: "not-01.pdf" }, null))
    ).toBe("brands.logo_unknown")
  })

  it("keeps refusing an SVG from the library, as for any catalogue picture", async () => {
    const container = containerWith([image("logo-01.svg", SVG_MIME)])
    expect(
      await refusal(brandFields(container, { name: "Örnek", logo_file_id: "logo-01.svg" }, null))
    ).toBe("media.svg_logo_only")
  })

  it("leaves a logo kept from before the rule as it is, and lets it be taken off", async () => {
    const container = containerWith([])
    const renamed = await brandFields(container, { name: "Yeni Ad" }, legacy)
    expect(renamed).toMatchObject({ logo_file_id: "faturalar/eski.pdf" })
    const same = await brandFields(container, { logo_file_id: "faturalar/eski.pdf" }, legacy)
    expect(same.logo_url).toBe("https://cdn/faturalar/eski.pdf")
    expect(listMediaAssets).not.toHaveBeenCalled()
    const removed = await brandFields(container, { logo_file_id: null }, legacy)
    expect(removed).toMatchObject({ logo_file_id: null, logo_url: null, logo_width: null })
  })
})
