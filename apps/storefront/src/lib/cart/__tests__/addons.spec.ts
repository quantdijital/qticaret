import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

// The backend's answers as each test sets them; the cart's own add as a stub
const api = vi.hoisted(() => ({
  storeGet: vi.fn(),
  storePost: vi.fn(),
  storeDelete: vi.fn(),
  storePublicFind: vi.fn(),
}))
vi.mock("../../store-api/server", () => api)
const cart = vi.hoisted(() => ({ addLine: vi.fn() }))
vi.mock("../cart", () => cart)
vi.mock("../cookie", () => ({ cartIdFromCookie: () => Promise.resolve("cart_1") }))

const { addAddonLine, productAddons, saveAddonLine } = await import("../addons")

const PICKS = [{ addon_id: "ad_yazi", value: "Ahmet" }]

describe("addAddonLine (adr/0052)", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset())
    cart.addLine.mockReset()
    cart.addLine.mockResolvedValue("cart_1")
    // The cart after the add: an older plain line of the same variant, and the new one with its mark
    api.storeGet.mockImplementation(() => {
      const mark = (cart.addLine.mock.calls[0]?.[2] as { addon_line: string }).addon_line
      return Promise.resolve({
        cart: {
          items: [
            { id: "cali_old", metadata: null },
            { id: "cali_new", metadata: { addon_line: mark } },
          ],
        },
      })
    })
  })

  it("adds a line of its own (never merged into a plain one), then its picks, never a price", async () => {
    api.storePost.mockResolvedValue({ line: {} })
    await addAddonLine("variant_1", 2, PICKS)
    const mark: unknown = expect.any(String)
    expect(cart.addLine).toHaveBeenCalledWith("variant_1", 2, { addon_line: mark })
    expect(api.storePost).toHaveBeenCalledWith("/store/carts/cart_1/line-items/cali_new/addons", {
      selections: PICKS,
    })
    expect(api.storeDelete).not.toHaveBeenCalled()
  })

  it("takes the new line back when its picks are refused, and passes the refusal on", async () => {
    api.storePost.mockRejectedValue(new StoreApiError(400, "addons.text_link", null))
    api.storeDelete.mockResolvedValue({})
    await expect(addAddonLine("variant_1", 1, PICKS)).rejects.toMatchObject({
      messageKey: "addons.text_link",
    })
    expect(api.storeDelete).toHaveBeenCalledWith("/store/carts/cart_1/line-items/cali_new")
  })

  it("writes a cart line's picks again; none takes them off", async () => {
    api.storePost.mockResolvedValue({ line: {} })
    await saveAddonLine("cali_new", [])
    expect(api.storePost).toHaveBeenCalledWith("/store/carts/cart_1/line-items/cali_new/addons", {
      selections: [],
    })
  })

  it("reads a product's add-ons as none offered while the route answers 404", async () => {
    api.storePublicFind.mockResolvedValueOnce(null)
    await expect(productAddons("prod_1")).resolves.toBeNull()
    api.storePublicFind.mockResolvedValueOnce({ addons: [{ id: "ad_yazi" }] })
    await expect(productAddons("prod_1")).resolves.toEqual([{ id: "ad_yazi" }])
    expect(api.storePublicFind).toHaveBeenCalledWith("/store/products/prod_1/addons")
  })
})
