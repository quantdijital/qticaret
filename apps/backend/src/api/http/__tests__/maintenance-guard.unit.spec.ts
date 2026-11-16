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
  /** The cached section object, when several requests share one snapshot. */
  section?: object
  /** Counts the uncached reads of the section's version. */
  reads?: jest.Mock
}

function request(
  method: string,
  path: string,
  shop: Shop,
  headers: Record<string, string> = {},
  body: unknown = {}
) {
  const values = shop.section ?? { enabled: shop.enabled, expected_at: shop.expected_at ?? null }
  const settings = {
    getSection: () =>
      shop.broken ? Promise.reject(new Error("db down")) : Promise.resolve(values),
    readSection: () => {
      shop.reads?.()
      return Promise.resolve({ values, version: shop.version ?? 1 })
    },
  }
  return {
    method,
    path,
    originalUrl: path,
    headers,
    body,
    query: {},
    scope: { resolve: () => settings },
  } as unknown as MedusaRequest
}

async function run(req: MedusaRequest, guard = refuseWritesInMaintenance) {
  const answer = fakeResponse()
  let passed = false
  await guard(req, answer.res, () => {
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

  it("closes every spelling of a closed path the router would take (review, info)", async () => {
    for (const path of [
      "/STORE/CARTS",
      "/store/carts/",
      "/store/carts?x=1",
      "http://magaza.test/store/carts",
      "/Store/Carts/cart_1/Complete",
      "/AUTH/customer/emailpass/register/",
    ]) {
      const answer = await run(request("POST", path, DARK))
      expect(`${path} ${String(answer.status)}`).toBe(`${path} 503`)
    }
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
      ["POST", "/hooks/iyzico/callback"],
      ["POST", "/admin/products"],
      ["POST", "/auth/user/emailpass"],
    ] as const) {
      expect((await run(request(method, path, DARK))).passed).toBe(true)
    }
  })

  it("takes a return request while dark, not an exchange", async () => {
    const returns = (body: unknown) =>
      run(request("POST", "/store/orders/order_1/returns", DARK, {}, body))
    expect((await returns({ kind: "return", items: [] })).passed).toBe(true)
    expect((await returns({ kind: "exchange", items: [] })).status).toBe(503)
  })

  it("never reads the setting for a request it would not close", async () => {
    const resolve = jest.fn()
    const req = { ...request("GET", "/store/products", DARK), scope: { resolve } }
    expect((await run(req as unknown as MedusaRequest)).passed).toBe(true)
    expect(resolve).not.toHaveBeenCalled()
  })

  it("keeps the last setting it read when a read fails (security review L1)", async () => {
    await run(request("POST", "/store/carts", DARK))
    const answer = await run(request("POST", "/store/carts", { enabled: false, broken: true }))
    expect(answer.status).toBe(503)
  })

  it("blocks nothing when the setting was never read and cannot be (fail-open, logged)", async () => {
    let fresh = refuseWritesInMaintenance
    jest.isolateModules(() => {
      fresh = jest.requireActual<{ refuseWritesInMaintenance: typeof fresh }>(
        "../maintenance-guard"
      ).refuseWritesInMaintenance
    })
    const answer = await run(
      request("POST", "/store/carts", { enabled: true, broken: true }),
      fresh
    )
    expect(answer.passed).toBe(true)
  })

  it("lets a bypass link's holder through, only with a link made for the section as saved now", async () => {
    const { token } = bypassToken(mockKey, 4)
    const other = bypassToken(randomBytes(32), 4).token
    const shop = { enabled: true, version: 4 }
    const withHeader = (value: string, at: Shop = shop) =>
      run(request("POST", "/store/carts", at, { "x-maintenance-bypass": value }))

    expect((await withHeader(token)).passed).toBe(true)
    // Saved since the link was made (a new cached section): it opens nothing
    expect((await withHeader(token, { enabled: true, version: 5 })).status).toBe(503)
    // Not signed with the shop's key, or not a token at all
    expect((await withHeader(other)).status).toBe(503)
    expect((await withHeader("1")).status).toBe(503)
    expect((await withHeader("")).status).toBe(503)
  })

  it("reads the section's version once per cached section, however many tokens come (security review L2)", async () => {
    const reads = jest.fn()
    const shop: Shop = {
      enabled: true,
      version: 4,
      section: { enabled: true, expected_at: null },
      reads,
    }
    const forged = bypassToken(randomBytes(32), 4).token
    const { token } = bypassToken(mockKey, 4)

    for (let i = 0; i < 5; i += 1) {
      expect(
        (await run(request("POST", "/store/carts", shop, { "x-maintenance-bypass": forged })))
          .status
      ).toBe(503)
    }
    expect(
      (await run(request("POST", "/store/carts", shop, { "x-maintenance-bypass": token }))).passed
    ).toBe(true)
    expect(reads).toHaveBeenCalledTimes(1)
  })

  it("closes a shopper's registration while dark", async () => {
    const answer = await run(request("POST", "/auth/customer/emailpass/register", DARK))
    expect(answer.status).toBe(503)
    expect(answer.body).toMatchObject({ message: "maintenance.shop_closed" })
  })
})
