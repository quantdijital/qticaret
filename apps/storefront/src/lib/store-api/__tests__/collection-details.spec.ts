import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

// The backend's answers as each test sets them
const api = vi.hoisted(() => ({
  storeGet: vi.fn(),
  storePublicGet: vi.fn(),
  storePublicFind: vi.fn(),
}))
vi.mock("../server", () => api)

const { categoryDescription, collectionDetails } = await import("../extras")

const IMAGE = {
  url: "https://cdn.example.com/yaz.jpg",
  alt: "Yaz seçkisi",
  width: 1600,
  height: 600,
  derivatives: null,
}

describe("collectionDetails (Ürünler > Koleksiyonlar)", () => {
  beforeEach(() => {
    api.storeGet.mockReset()
  })

  it("asks the collection's own route and gives its intro and picture", async () => {
    api.storeGet.mockResolvedValue({ details: { description: "Yazın.", image: IMAGE } })
    await expect(collectionDetails("pcol_1/../x")).resolves.toEqual({
      description: "Yazın.",
      image: IMAGE,
    })
    expect(api.storeGet).toHaveBeenCalledWith("/store/collections/pcol_1%2F..%2Fx/details")
  })

  it("draws the page without them when the backend does not answer (hidden since, or older)", async () => {
    api.storeGet.mockRejectedValue(new StoreApiError(404, "catalog.collection_unknown", null))
    await expect(collectionDetails("pcol_2")).resolves.toEqual({
      description: null,
      description_html: null,
      image: null,
    })
  })

  it("lets any other failure through", async () => {
    api.storeGet.mockRejectedValue(new Error("network"))
    await expect(collectionDetails("pcol_3")).rejects.toThrow("network")
  })
})

describe("categoryDescription (adr/0075)", () => {
  beforeEach(() => {
    api.storePublicFind.mockReset()
  })

  it("asks the category's own route and gives its document's HTML", async () => {
    api.storePublicFind.mockResolvedValue({
      category_id: "pcat_1",
      description_html: "<p>Çelik.</p>",
    })
    await expect(categoryDescription("pcat_1/../x")).resolves.toBe("<p>Çelik.</p>")
    expect(api.storePublicFind).toHaveBeenCalledWith("/store/category-descriptions/pcat_1%2F..%2Fx")
  })

  it("gives none for a category without one, a hidden one (404: null) or a failed call", async () => {
    api.storePublicFind.mockResolvedValueOnce({ category_id: "pcat_2", description_html: null })
    await expect(categoryDescription("pcat_2")).resolves.toBeNull()
    api.storePublicFind.mockResolvedValueOnce(null)
    await expect(categoryDescription("pcat_3")).resolves.toBeNull()
    api.storePublicFind.mockRejectedValueOnce(new Error("network"))
    await expect(categoryDescription("pcat_4")).resolves.toBeNull()
  })
})
