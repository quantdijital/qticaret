import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ storePost: vi.fn(), storeCall: vi.fn() }))
vi.mock("@/lib/store-api/server", () => api)
vi.mock("@/lib/checkout/options", () => ({
  CONTRACT_KINDS: ["pre_information", "distance_sales"],
  ageCheck: () => Promise.resolve({ required: false, declared: false }),
}))

const { PlaceOrder, saveOrderNote } = await import("../place-order")
const { orderNoteOf } = await import("../order-note")

const inputOf = (fields: Record<string, string>) => ({
  ...PlaceOrder.parse({ provider_id: "pp_paytr_paytr", ...fields }),
  contracts: [],
})

/** Batch 8 / O1: the shopper's note goes on the cart before the payment starts. */
describe("saveOrderNote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.storePost.mockResolvedValue({})
  })

  it("sends the note as typed; the backend cleans it", async () => {
    await saveOrderNote("cart_1", inputOf({ order_note: "Zili çalmayın" }))
    expect(api.storePost).toHaveBeenCalledWith("/store/carts/cart_1/order-note", {
      note: "Zili çalmayın",
    })
  })

  it("sends an emptied field, which takes the cart's off", async () => {
    await saveOrderNote("cart_1", inputOf({ order_note: "" }))
    expect(api.storePost).toHaveBeenCalledWith("/store/carts/cart_1/order-note", { note: "" })
  })

  it("leaves the cart's note alone when the theme draws no field", async () => {
    await saveOrderNote("cart_1", inputOf({}))
    expect(api.storePost).not.toHaveBeenCalled()
  })

  it("refuses a note far over the limit before asking the backend", () => {
    expect(
      PlaceOrder.safeParse({ provider_id: "credit", order_note: "a".repeat(2001) }).success
    ).toBe(false)
  })
})

describe("orderNoteOf", () => {
  it("reads only a string note", () => {
    expect(orderNoteOf({ qt_order_note: "Kapıya bırakın" })).toBe("Kapıya bırakın")
    expect(orderNoteOf({ qt_order_note: 3 })).toBeNull()
    expect(orderNoteOf(null)).toBeNull()
  })
})
