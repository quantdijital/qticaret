import { afterEach, describe, expect, it, vi } from "vitest"
import { t } from "@/lib/i18n"
import { returnableOf } from "@/lib/views/order-returns"
import { GIFT, KNIFE, giftLine, knifeLine, order } from "@/test/order-fixtures"

// No session, the backend at a test address; its answers as each test sets them
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))
vi.mock("@/lib/env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("@/lib/store-api/publishable-key", () => ({
  publishableKey: () => Promise.resolve("pk_test1234"),
}))

const { orderReturnable } = await import("../order")

const ORDER = "order_01K0000000000000000000ORDER"
const TOKEN = `abc123.${"x".repeat(43)}`

/** What `GET /store/orders/:id/returnable` answers (backend `order-access-returnable.spec.ts`). */
const ANSWER = {
  window_open: true,
  open_request: false,
  lines: [
    {
      line_item_id: KNIFE,
      title: "Çakı",
      variant_title: "Siyah",
      variant_id: "variant_knife",
      returnable: 0,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      gift_card: false,
      variants: [{ id: "variant_other", title: "Kahverengi" }],
    },
    {
      line_item_id: GIFT,
      title: "Hediye kartı",
      variant_title: "500 TL",
      variant_id: "variant_gift",
      returnable: 0,
      withdrawal_excluded: true,
      withdrawal_excluded_reason: "gift_card_used",
      gift_card: true,
      variants: [],
    },
  ],
}

const answer = (body: unknown, status = 200) => {
  const fetch = vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    )
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("orderReturnable (adr/0025, 2026-11-03)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks the backend with the order's key, never from a cache, and reads its answer as given", async () => {
    const fetch = answer(ANSWER)
    await expect(orderReturnable(ORDER, TOKEN)).resolves.toEqual(ANSWER)
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url instanceof URL ? url.href : url).toBe(
      `http://backend.test/store/orders/${ORDER}/returnable`
    )
    expect(init).toMatchObject({ method: "GET", cache: "no-store" })
    expect(init?.headers).toMatchObject({ "x-order-token": TOKEN })
  })

  it("asks as the signed-in customer without a key", async () => {
    const fetch = answer(ANSWER)
    await orderReturnable(ORDER, null)
    expect(fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("x-order-token")
  })

  it("is null when the backend will not say, and lets anything else through", async () => {
    answer({ message: "orders.unknown" }, 404)
    await expect(orderReturnable(ORDER, TOKEN)).resolves.toBeNull()
    answer({ message: "errors.internal" }, 500)
    await expect(orderReturnable(ORDER, TOKEN)).resolves.toBeNull()
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("fetch failed")))
    )
    await expect(orderReturnable(ORDER, TOKEN)).rejects.toThrow("fetch failed")
  })

  it("is what the order page's return lines are made of", async () => {
    answer(ANSWER)
    const found = await orderReturnable(ORDER, TOKEN)
    expect(returnableOf(found, order([knifeLine, giftLine(["AB12"])]), t)).toEqual([
      {
        id: GIFT,
        title: "Hediye kartı",
        quantity: 0,
        excluded: "gift_card_used",
        gift: true,
        note: "Kart kullanıldığı için cayma hakkı yok.",
      },
    ])
  })
})
