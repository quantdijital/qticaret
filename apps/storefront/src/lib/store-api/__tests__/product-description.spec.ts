import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

// The backend's answers as each test sets them
const api = vi.hoisted(() => ({ storeGet: vi.fn() }))
vi.mock("../server", () => api)

const { productTexts } = await import("../product-description")

const HTML =
  "<h2>Kullanım</h2><table><tbody><tr><td>Uzunluk</td><td>21 cm</td></tr></tbody></table>"
const SUMMARY = "<p>El yapımı, <strong>günlük</strong> kullanım için.</p>"

const NONE = { description: null, summary: null }

describe("productTexts (adr/0055, Ek 2026-11-06)", () => {
  beforeEach(() => {
    api.storeGet.mockReset()
  })

  it("asks the product's own route and gives both documents' HTML as the backend wrote it", async () => {
    api.storeGet.mockResolvedValue({ html: HTML, summary_html: SUMMARY })
    await expect(productTexts("prod_1/../x")).resolves.toEqual({
      description: HTML,
      summary: SUMMARY,
    })
    expect(api.storeGet).toHaveBeenCalledWith("/store/products/prod_1%2F..%2Fx/description")
  })

  it("reads a product without a document, or an empty one, as none", async () => {
    api.storeGet.mockResolvedValueOnce({ html: null, summary_html: null })
    await expect(productTexts("prod_2")).resolves.toEqual(NONE)
    api.storeGet.mockResolvedValueOnce({ html: "  ", summary_html: " " })
    await expect(productTexts("prod_3")).resolves.toEqual(NONE)
    // An older backend's answer, without the short description
    api.storeGet.mockResolvedValueOnce({ html: HTML })
    await expect(productTexts("prod_6")).resolves.toEqual({ description: HTML, summary: null })
  })

  it("prints the texts' library pictures in their versions, lazily (docs/21 2026-11-06)", async () => {
    const url = "https://cdn.example.com/kabza.jpg"
    api.storeGet.mockResolvedValue({
      html: `<figure><img src="${url}" alt="Kabza" loading="lazy" decoding="async"></figure>`,
      summary_html: SUMMARY,
      images: [
        {
          url,
          width: 900,
          height: 600,
          derivatives: {
            srcset: { webp: [{ width: 400, url: "https://cdn.example.com/k-400.webp" }] },
          },
        },
      ],
    })
    const texts = await productTexts("prod_7")
    expect(texts.description).toContain('srcset="https://cdn.example.com/k-400.webp 400w"')
    expect(texts.description).toContain('width="900" height="600" loading="lazy"')
    expect(texts.summary).toBe(SUMMARY)
  })

  it("reads a refusal or a failed call as none: the page shows the plain text instead", async () => {
    api.storeGet.mockRejectedValueOnce(new StoreApiError(404, "catalog.product_unknown", null))
    await expect(productTexts("prod_4")).resolves.toEqual(NONE)
    api.storeGet.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(productTexts("prod_5")).resolves.toEqual(NONE)
  })
})
