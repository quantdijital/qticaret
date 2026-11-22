import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const next = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: next.revalidatePath }))
vi.mock("next/navigation", () => ({ redirect: next.redirect }))
const api = vi.hoisted(() => ({ storeCall: vi.fn() }))
vi.mock("@/lib/store-api/server", () => api)

const { cancelBooking } = await import("../order")

const ORDER = "order_01K0000000000000000000ORDER"
const SLOT = "bkslot_01K00000000000000000SLOT"
const TOKEN = `abc123.${"x".repeat(43)}`

const form = (extra: Record<string, string> = {}) => {
  const data = new FormData()
  Object.entries({ order_id: ORDER, token: TOKEN, slot_id: SLOT, ...extra }).forEach(
    ([name, value]) => {
      data.set(name, value)
    }
  )
  return data
}
const back = (note: string) => `redirect:/siparis/${ORDER}?token=${TOKEN}&durum=${note}`

describe("cancelBooking (adr/0076 Ek D7a)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.storeCall.mockResolvedValue({ cancelled: true })
  })

  it("sends the departure alone with the order's key, never an amount", async () => {
    await expect(cancelBooking(form({ amount: "999", refund: "999" }))).rejects.toThrow(
      back("rezervasyon-iptal")
    )
    expect(api.storeCall).toHaveBeenCalledWith(`/store/orders/${ORDER}/bookings/cancel`, {
      method: "POST",
      body: { slot_id: SLOT },
      headers: { "x-order-token": TOKEN },
    })
    expect(next.revalidatePath).toHaveBeenCalledWith(`/siparis/${ORDER}`)
  })

  it.each([
    ["booking.cancel_too_late", 400, "rezervasyon-gec"],
    ["booking.cancel_unavailable", 400, "rezervasyon-kademe-yok"],
    ["orders.cancel_contact_shop", 400, "rezervasyon-magaza"],
    // adr/0076 Ek basit yol: the shop takes cancels by phone or e-mail
    ["booking.cancel_by_contact", 400, "rezervasyon-iletisim"],
    ["booking.cancel_unknown", 404, "rezervasyon-iptal-olmadi"],
    [null, 500, "rezervasyon-iptal-olmadi"],
  ])("says the backend's %s refusal in its own words", async (key, status, note) => {
    api.storeCall.mockRejectedValue(new StoreApiError(status, key, null))
    await expect(cancelBooking(form())).rejects.toThrow(back(note))
  })

  it("sends nothing for a departure that is not one", async () => {
    await expect(cancelBooking(form({ slot_id: "order_1" }))).rejects.toThrow("redirect:/")
    expect(api.storeCall).not.toHaveBeenCalled()
  })
})
