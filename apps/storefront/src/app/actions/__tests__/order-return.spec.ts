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

const { cancelOrder, requestReturn } = await import("../order")

const ORDER = "order_01K0000000000000000000ORDER"
const GIFT = "ordli_01K0000000000000000000GIFT"
const KNIFE = "ordli_01K000000000000000000KNIFE"
const TOKEN = `abc123.${"x".repeat(43)}`

/** The gift card form as the base theme posts it: its line alone, `kind=return`, the right of withdrawal. */
const giftForm = (extra: Record<string, string> = {}) => {
  const data = new FormData()
  Object.entries({
    order_id: ORDER,
    token: TOKEN,
    kind: "return",
    reason: "changed_mind",
    note: "",
    [`qty_${GIFT}`]: "1",
    ...extra,
  }).forEach(([name, value]) => {
    data.set(name, value)
  })
  return data
}

const ask = (form: FormData) => requestReturn({ ok: false, error: null }, form)

describe("requestReturn for a gift card line (adr/0025, 2026-11-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.storeCall.mockResolvedValue({ return_request: { id: "rr_1", status: "requested" } })
  })

  it("asks for the gift line alone, as money back on the right of withdrawal, with the order's key", async () => {
    await expect(ask(giftForm())).resolves.toEqual({ ok: true, error: null })
    expect(api.storeCall).toHaveBeenCalledWith(`/store/orders/${ORDER}/returns`, {
      method: "POST",
      body: {
        kind: "return",
        items: [{ line_item_id: GIFT, quantity: 1 }],
        reason: "changed_mind",
      },
      headers: { "x-order-token": TOKEN },
    })
    expect(next.revalidatePath).toHaveBeenCalledWith(`/siparis/${ORDER}`)
  })

  it.each([
    ["returns.gift_card_separate", { [`qty_${KNIFE}`]: "1" }],
    ["returns.gift_card_used", { reason: "damaged" }],
    ["returns.already_open", {}],
    ["returns.withdrawal_excluded", {}],
  ])("says the backend's %s in its own words", async (key, extra) => {
    api.storeCall.mockRejectedValue(new StoreApiError(400, key, null))
    await expect(ask(giftForm(extra))).resolves.toEqual({ ok: false, error: key })
    expect(next.revalidatePath).not.toHaveBeenCalled()
  })

  it("falls back to the general refusal for anything else, and to the budget's words on 429", async () => {
    api.storeCall.mockRejectedValue(new StoreApiError(400, "returns.window_closed", null))
    await expect(ask(giftForm())).resolves.toEqual({ ok: false, error: "order.return_failed" })
    api.storeCall.mockRejectedValue(new StoreApiError(429, "returns.gift_card_used", null))
    await expect(ask(giftForm())).resolves.toEqual({
      ok: false,
      error: "errors.too_many_requests",
    })
  })

  it("sends nothing without a unit chosen", async () => {
    await expect(ask(giftForm({ [`qty_${GIFT}`]: "0" }))).resolves.toEqual({
      ok: false,
      error: "order.return_items_required",
    })
    expect(api.storeCall).not.toHaveBeenCalled()
  })
})

describe("requestReturn as an exchange (adr/0032 §6)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.storeCall.mockResolvedValue({ return_request: { id: "rr_1", status: "requested" } })
  })

  const swapForm = (extra: Record<string, string>) => {
    const data = new FormData()
    Object.entries({
      order_id: ORDER,
      token: "",
      kind: "exchange",
      reason: "size_issue",
      [`qty_${KNIFE}`]: "1",
      ...extra,
    }).forEach(([name, value]) => {
      data.set(name, value)
    })
    return data
  }

  it("sends each line with the variant it goes back for, never a price", async () => {
    await expect(ask(swapForm({ [`variant_${KNIFE}`]: "variant_01KBUYUK" }))).resolves.toEqual({
      ok: true,
      error: null,
    })
    expect(api.storeCall).toHaveBeenCalledWith(`/store/orders/${ORDER}/returns`, {
      method: "POST",
      body: {
        kind: "exchange",
        items: [{ line_item_id: KNIFE, quantity: 1, variant_id: "variant_01KBUYUK" }],
        reason: "size_issue",
      },
      headers: {},
    })
  })

  it("asks for the variant before sending, and says the backend's exchange refusals", async () => {
    await expect(ask(swapForm({}))).resolves.toEqual({
      ok: false,
      error: "order.return_variant_required",
    })
    await expect(ask(swapForm({ [`variant_${KNIFE}`]: "fiyat=1" }))).resolves.toEqual({
      ok: false,
      error: "order.return_variant_required",
    })
    expect(api.storeCall).not.toHaveBeenCalled()
    api.storeCall.mockRejectedValue(new StoreApiError(400, "returns.exchange_out_of_stock", null))
    await expect(ask(swapForm({ [`variant_${KNIFE}`]: "variant_01KBUYUK" }))).resolves.toEqual({
      ok: false,
      error: "returns.exchange_out_of_stock",
    })
  })
})

describe("cancelOrder (F7.13; a gift order while its cards are untouched, adr/0025)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.storeCall.mockResolvedValue({ order_id: ORDER, canceled: true })
  })

  const cancelForm = (token = TOKEN) => {
    const data = new FormData()
    data.set("order_id", ORDER)
    data.set("token", token)
    return data
  }
  const back = (note: string) => `redirect:/siparis/${ORDER}?token=${TOKEN}&durum=${note}`

  it("cancels with the order's key and says so", async () => {
    await expect(cancelOrder(cancelForm())).rejects.toThrow(back("iptal"))
    expect(api.storeCall).toHaveBeenCalledWith(`/store/orders/${ORDER}/cancel`, {
      method: "POST",
      body: {},
      headers: { "x-order-token": TOKEN },
    })
    expect(next.revalidatePath).toHaveBeenCalledWith(`/siparis/${ORDER}`)
  })

  it.each([
    ["orders.gift_card_used", 409, "iptal-hediye-karti"],
    ["orders.cancel_contact_shop", 400, "iptal-magaza"],
    // A refund of the order still being settled: wait, it is no refusal
    ["orders.refund_unsettled", 409, "iptal-iade-isleniyor"],
    ["orders.cancel_after_packing", 400, "iptal-olmadi"],
    [null, 500, "iptal-olmadi"],
  ])("says the backend's %s refusal in its own words", async (key, status, note) => {
    api.storeCall.mockRejectedValue(new StoreApiError(status, key, null))
    await expect(cancelOrder(cancelForm())).rejects.toThrow(back(note))
  })

  it("lets anything but the backend's answer through", async () => {
    api.storeCall.mockRejectedValue(new Error("network"))
    await expect(cancelOrder(cancelForm())).rejects.toThrow("network")
    expect(next.redirect).not.toHaveBeenCalled()
  })
})
