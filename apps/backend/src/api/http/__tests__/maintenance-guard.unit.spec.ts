import { randomBytes } from "node:crypto"
import type { MedusaRequest } from "@medusajs/framework/http"
import { bypassToken } from "../../../lib/storefront/maintenance"
import { refuseWritesInMaintenance } from "../maintenance-guard"
import { fakeResponse } from "./fakes"

const mockKey = randomBytes(32)

jest.mock("../../../lib/orders/access-token", () => ({ orderAccessKey: () => mockKey }))

interface Shop {
  enabled: boolean
  expected_at?: string | null
  version?: number
  /** The settings cannot be read (a database or cache failure). */
  broken?: boolean
}

function request(method: string, path: string, shop: Shop, headers: Record<string, string> = {}) {
  const values = { enabled: shop.enabled, expected_at: shop.expected_at ?? null }
  const settings = {
    getSection: () =>
      shop.broken ? Promise.reject(new Error("db down")) : Promise.resolve(values),
    readSection: () => Promise.resolve({ values, version: shop.version ?? 1 }),
  }
  return {
    method,
    path,
    originalUrl: path,
    headers,
    body: {},
    query: {},
    scope: { resolve: () => settings },
  } as unknown as MedusaRequest
}

async function run(req: MedusaRequest) {
  const answer = fakeResponse()
  let passed = false
  await refuseWritesInMaintenance(req, answer.res, () => {
    passed = true
  })
  return { passed, status: answer.status(), body: answer.body(), headers: answer.headers }
}

const DARK = { enabled: true }

describe("refuseWritesInMaintenance", () => {
  it("refuses a cart write while dark: 503, the key, Retry-After, no-store", async () => {
    const answer = await run(request("POST", "/store/carts", DARK))

    expect(answer.passed).toBe(false)
    expect(answer.status).toBe(503)
    expect(answer.body).toMatchObject({ type: "unavailable", message: "maintenance.shop_closed" })
    expect(answer.headers["retry-after"]).toBe("3600")
    expect(answer.headers["cache-control"]).toBe("no-store")
  })

  it("asks to come back when the shop said it would open", async () => {
    const soon = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
    const answer = await run(request("POST", "/store/carts", { enabled: true, expected_at: soon }))

    const seconds = Number(answer.headers["retry-after"])
    expect(seconds).toBeGreaterThan(7100)
    expect(seconds).toBeLessThanOrEqual(7200)
  })

  it("lets everything through while the shop is open", async () => {
    for (const path of ["/store/carts", "/store/carts/cart_1/complete", "/store/customers"]) {
      expect((await run(request("POST", path, { enabled: false }))).passed).toBe(true)
    }
  })

  it("lets reads, open writes and requests outside the Store API through while dark", async () => {
    for (const [method, path] of [
      ["GET", "/store/products"],
      ["GET", "/store/carts/cart_1"],
      ["POST", "/store/carts/cart_1/order-access"],
      ["POST", "/hooks/paytr"],
      ["POST", "/admin/products"],
      ["POST", "/auth/user/emailpass"],
    ] as const) {
      expect((await run(request(method, path, DARK))).passed).toBe(true)
    }
  })

  it("never reads the setting for a request it would not close", async () => {
    const resolve = jest.fn()
    const req = { ...request("GET", "/store/products", DARK), scope: { resolve } }
    expect((await run(req as unknown as MedusaRequest)).passed).toBe(true)
    expect(resolve).not.toHaveBeenCalled()
  })

  it("blocks nothing when the setting cannot be read (fail-open, logged)", async () => {
    const answer = await run(request("POST", "/store/carts", { enabled: true, broken: true }))
    expect(answer.passed).toBe(true)
  })

  it("lets a bypass link's holder through, only with a link made for the section as saved now", async () => {
    const { token } = bypassToken(mockKey, 4)
    const other = bypassToken(randomBytes(32), 4).token
    const shop = { enabled: true, version: 4 }
    const withHeader = (value: string, at = shop) =>
      run(request("POST", "/store/carts", at, { "x-maintenance-bypass": value }))

    expect((await withHeader(token)).passed).toBe(true)
    // Saved since the link was made: it opens nothing
    expect((await withHeader(token, { enabled: true, version: 5 })).status).toBe(503)
    // Not signed with the shop's key, or not a token at all
    expect((await withHeader(other)).status).toBe(503)
    expect((await withHeader("1")).status).toBe(503)
    expect((await withHeader("")).status).toBe(503)
  })

  it("closes a shopper's registration while dark", async () => {
    const answer = await run(request("POST", "/auth/customer/emailpass/register", DARK))
    expect(answer.status).toBe(503)
    expect(answer.body).toMatchObject({ message: "maintenance.shop_closed" })
  })
})
