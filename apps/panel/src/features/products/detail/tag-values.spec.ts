import { beforeEach, describe, expect, it, vi } from "vitest"
import { tagIds } from "./tag-values"

const productTag = vi.hoisted(() => ({ create: vi.fn(), list: vi.fn(), delete: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { admin: { productTag } } }))

beforeEach(() => {
  productTag.list.mockReset().mockResolvedValue({ product_tags: [] })
  productTag.delete.mockReset().mockResolvedValue({ deleted: true })
  productTag.create.mockReset()
})

describe("tagIds (#251 D1)", () => {
  it("uses a shop tag whose name differs only in letter case, and creates the rest", async () => {
    productTag.list.mockImplementation(({ q }: { q: string }) =>
      Promise.resolve({
        product_tags: q === "İnce Kumaş" ? [{ id: "ptag_ince", value: "ince kumaş" }] : [],
      })
    )
    productTag.create.mockResolvedValue({ product_tag: { id: "ptag_new" } })
    const result = await tagIds([
      { id: "ptag_1", value: "pamuklu" },
      { id: null, value: " İnce Kumaş " },
      { id: null, value: "yaz sezonu" },
    ])
    expect(result).toEqual({ ids: ["ptag_1", "ptag_ince", "ptag_new"], created: ["ptag_new"] })
    expect(productTag.create).toHaveBeenCalledTimes(1)
    expect(productTag.create).toHaveBeenCalledWith({ value: "yaz sezonu" })
  })

  it("takes back the tags it created when a later one fails", async () => {
    productTag.create
      .mockResolvedValueOnce({ product_tag: { id: "ptag_a" } })
      .mockRejectedValueOnce(new Error("boom"))
    await expect(
      tagIds([
        { id: null, value: "bir" },
        { id: null, value: "iki" },
      ])
    ).rejects.toThrow("boom")
    expect(productTag.delete).toHaveBeenCalledWith("ptag_a")
    expect(productTag.delete).toHaveBeenCalledTimes(1)
  })
})
