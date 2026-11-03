import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

// The backend's answers as each test sets them
const api = vi.hoisted(() => ({ storeGet: vi.fn() }))
vi.mock("../server", () => api)

const { productDescriptionHtml } = await import("../product-description")

const HTML =
  "<h2>Kullanım</h2><table><tbody><tr><td>Uzunluk</td><td>21 cm</td></tr></tbody></table>"

describe("productDescriptionHtml (adr/0055)", () => {
  beforeEach(() => {
    api.storeGet.mockReset()
  })

  it("asks the product's own route and gives its document's HTML as the backend wrote it", async () => {
    api.storeGet.mockResolvedValue({ html: HTML })
    await expect(productDescriptionHtml("prod_1/../x")).resolves.toBe(HTML)
    expect(api.storeGet).toHaveBeenCalledWith("/store/products/prod_1%2F..%2Fx/description")
  })

  it("reads a product without a document, or an empty one, as none", async () => {
    api.storeGet.mockResolvedValueOnce({ html: null })
    await expect(productDescriptionHtml("prod_2")).resolves.toBeNull()
    api.storeGet.mockResolvedValueOnce({ html: "  " })
    await expect(productDescriptionHtml("prod_3")).resolves.toBeNull()
  })

  it("reads a refusal or a failed call as none: the page shows the plain text instead", async () => {
    api.storeGet.mockRejectedValueOnce(new StoreApiError(404, "catalog.product_unknown", null))
    await expect(productDescriptionHtml("prod_4")).resolves.toBeNull()
    api.storeGet.mockRejectedValueOnce(new TypeError("fetch failed"))
    await expect(productDescriptionHtml("prod_5")).resolves.toBeNull()
  })
})
