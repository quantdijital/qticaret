import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import {
  RETRY_AFTER_DEFAULT,
  decideMaintenanceRequest,
  maintenanceRetryAfter,
} from "../maintenance-guard"

/**
 * Every write of ours under the Store API, with what a dark shop does with
 * it (adr/0053 Ek 2026-11-17). A new write route fails here until someone
 * decides; the guard closes it meanwhile (closed unless named open).
 */
const OWN_STORE_WRITES: Readonly<Record<string, "closed" | "open">> = {
  "POST /store/cart-reminders/redeem": "closed",
  "POST /store/carts/:id/age-declaration": "closed",
  "POST /store/carts/:id/bookings": "closed",
  "DELETE /store/carts/:id/bookings/:slot_id": "closed",
  "POST /store/carts/:id/consents": "closed",
  "POST /store/carts/:id/legal-consents": "closed",
  "POST /store/carts/:id/line-items/:line_id/addons": "closed",
  "POST /store/carts/:id/line-items/:line_id/gift": "closed",
  // Read by POST: the payment result page finds the order a paid card became
  "POST /store/carts/:id/order-access": "open",
  "POST /store/carts/:id/payment-session": "closed",
  "POST /store/carts/:id/source": "closed",
  "POST /store/carts/:id/tracking": "closed",
  "POST /store/carts/:id/travelers": "closed",
  "POST /store/consents/confirm": "open",
  "POST /store/consents/cookies": "open",
  "POST /store/consents/unsubscribe": "open",
  "POST /store/contact-messages": "closed",
  "POST /store/customers/me/billing-profile": "closed",
  "POST /store/customers/me/consents": "open",
  "POST /store/customers/me/migration-claim": "closed",
  "POST /store/customers/me/privacy-requests": "open",
  "POST /store/customers/me/wishlist": "closed",
  "DELETE /store/customers/me/wishlist/:id": "closed",
  "POST /store/gift-cards/balance": "open",
  "POST /store/newsletter": "closed",
  "POST /store/order-lookup": "open",
  "POST /store/orders/:id/cancel": "open",
  "POST /store/orders/:id/returns": "open",
  "POST /store/payment-links/:token/cart": "closed",
  "POST /store/product-questions/:id/answers": "closed",
  "POST /store/products/:id/questions": "closed",
  "POST /store/products/:id/reviews": "closed",
  "POST /store/products/:id/reviews/photos": "closed",
  "POST /store/seo/not-found": "open",
  "POST /store/stock-alerts": "closed",
  "POST /store/stock-alerts/confirm": "open",
}

/** Medusa's own Store API writes and the auth routes a shopper reaches. */
const CORE_WRITES: Readonly<Record<string, "closed" | "open">> = {
  "POST /store/carts": "closed",
  "POST /store/carts/:id": "closed",
  "POST /store/carts/:id/line-items": "closed",
  "POST /store/carts/:id/line-items/:line_id": "closed",
  "DELETE /store/carts/:id/line-items/:line_id": "closed",
  "POST /store/carts/:id/promotions": "closed",
  "DELETE /store/carts/:id/promotions": "closed",
  "POST /store/carts/:id/gift-cards": "closed",
  "DELETE /store/carts/:id/gift-cards": "closed",
  "POST /store/carts/:id/shipping-methods": "closed",
  "POST /store/carts/:id/taxes": "closed",
  "POST /store/carts/:id/customer": "closed",
  "POST /store/carts/:id/complete": "closed",
  "POST /store/payment-collections": "closed",
  "POST /store/payment-collections/:id/payment-sessions": "closed",
  "POST /store/customers": "closed",
  "POST /store/customers/me": "closed",
  "POST /store/customers/me/addresses": "closed",
  "POST /store/customers/me/addresses/:address_id": "closed",
  "DELETE /store/customers/me/addresses/:address_id": "closed",
  "POST /store/orders/:id/transfer/request": "closed",
  "POST /store/returns": "closed",
  "POST /store/shipping-options/:id/calculate": "open",
  "POST /auth/customer/:provider/register": "closed",
  // Signing in, a password reset, a session: no sale, and a shopper may need to secure an account
  "POST /auth/customer/:provider": "open",
  "POST /auth/customer/:provider/reset-password": "open",
  "POST /auth/customer/:provider/update": "open",
  "POST /auth/session": "open",
  "DELETE /auth/session": "open",
  "POST /auth/token/refresh": "open",
  "POST /auth/verification/request": "open",
}

/** Never closed: the panel, staff sign-in, provider callbacks, links in messages, health. */
const NEVER_CLOSED = [
  "POST /admin/products",
  "POST /admin/platform-settings/maintenance",
  "POST /admin/maintenance/bypass",
  "DELETE /admin/products/:id",
  "POST /auth/user/emailpass",
  "POST /auth/user/emailpass/register",
  "POST /hooks/paytr",
  "POST /hooks/iyzico/callback",
  "POST /hooks/geliver",
  "POST /hooks/resend",
  "POST /hooks/control-plane/plan",
  "POST /unsubscribe",
  "POST /consents/confirm",
  "POST /stock-alerts/confirm",
  "GET /health",
  "GET /feeds/:token/google",
]

const STORE = join(__dirname, "../../../api/store")
const HANDLER = /^export (?:async function|function|const|let) (POST|PUT|PATCH|DELETE)\b/gm

function ownStoreWrites(): Set<string> {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
      } else if (name === "route.ts") {
        const route = `/store/${relative(STORE, dir)}`.replace(/\[(\w+)\]/g, ":$1")
        for (const match of readFileSync(path, "utf8").matchAll(HANDLER)) {
          found.add(`${match[1] ?? ""} ${route}`)
        }
      }
    }
  }
  walk(STORE)
  return found
}

// A route as a request reaches the guard: each parameter a real id
const requestOf = (route: string): [string, string] => {
  const [method = "", pattern = ""] = route.split(" ")
  return [method, pattern.replace(/:\w+/g, "x_01jabc")]
}

// With a body as the parser leaves it: `{}` for a POST without one
const decided = (route: string) =>
  decideMaintenanceRequest(...requestOf(route), {}).closed ? "closed" : "open"

describe("the Store API while the shop is in maintenance (adr/0053 Ek 2026-11-17)", () => {
  it("has a decision for every write route of ours, and none for a route that is gone", () => {
    const found = ownStoreWrites()
    expect([...found].filter((route) => !(route in OWN_STORE_WRITES)).sort()).toEqual([])
    expect(
      Object.keys(OWN_STORE_WRITES)
        .filter((route) => !found.has(route))
        .sort()
    ).toEqual([])
  })

  it("closes and opens each write as decided", () => {
    for (const [route, decision] of Object.entries({ ...OWN_STORE_WRITES, ...CORE_WRITES })) {
      expect(`${route} ${decided(route)}`).toBe(`${route} ${decision}`)
    }
  })

  it("never closes the panel, staff sign-in, provider callbacks or the links in messages", () => {
    for (const route of NEVER_CLOSED) {
      expect(`${route} ${decided(route)}`).toBe(`${route} open`)
    }
  })

  it("keeps every read open, under the Store API too", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
      expect(decideMaintenanceRequest(method, "/store/carts").closed).toBe(false)
      expect(decideMaintenanceRequest(method, "/store/products").closed).toBe(false)
      expect(decideMaintenanceRequest(method, "/store/maintenance/bypass/x").closed).toBe(false)
    }
  })

  it("closes a write it has never heard of, and any method that is not a read", () => {
    expect(decideMaintenanceRequest("POST", "/store/something-new")).toEqual({
      closed: true,
      reason: "maintenance_store_write",
    })
    expect(decideMaintenanceRequest("PUT", "/store/carts/x").closed).toBe(true)
    expect(decideMaintenanceRequest("post", "/store/carts").closed).toBe(true)
    expect(decideMaintenanceRequest("TRACE", "/store/carts").closed).toBe(true)
    expect(decideMaintenanceRequest("POST", "/store").closed).toBe(true)
    expect(decideMaintenanceRequest("POST", "/auth/customer/google/register")).toEqual({
      closed: true,
      reason: "maintenance_registration",
    })
  })

  it("opens an open write only at its exact path, not below or beside it", () => {
    expect(decideMaintenanceRequest("POST", "/store/carts/x/order-access/more").closed).toBe(true)
    expect(decideMaintenanceRequest("POST", "/store/order-lookup-x").closed).toBe(true)
    expect(decideMaintenanceRequest("POST", "/store/orders/x/y/cancel").closed).toBe(true)
    expect(decideMaintenanceRequest("POST", "/store/consents/cookies/x").closed).toBe(true)
    // A storefront path is never a Store API one: `/storefront` is not `/store`
    expect(decideMaintenanceRequest("POST", "/storefront/x").closed).toBe(false)
  })

  it("takes a return request, never an exchange (security review L4)", () => {
    const returns = (body: unknown) =>
      decideMaintenanceRequest("POST", "/store/orders/order_1/returns", body)

    expect(returns({ kind: "return", items: [] }).closed).toBe(false)
    // Left out, the route's schema makes it a return
    expect(returns({ items: [] }).closed).toBe(false)
    expect(returns({ kind: "exchange", items: [] })).toEqual({
      closed: true,
      reason: "maintenance_exchange",
    })
    for (const body of [{ kind: "RETURN" }, { kind: null }, undefined, null, [], "kind=return"]) {
      expect(returns(body).closed).toBe(true)
    }
  })
})

describe("maintenance Retry-After", () => {
  const NOW = Date.parse("2026-11-17T10:00:00Z")

  it("counts down to the expected time, within five minutes and a day", () => {
    expect(maintenanceRetryAfter("2026-11-17T12:00:00+00:00", NOW)).toBe(7200)
    expect(maintenanceRetryAfter("2026-11-17T10:01:00Z", NOW)).toBe(300)
    expect(maintenanceRetryAfter("2026-11-20T10:00:00Z", NOW)).toBe(86_400)
  })

  it("asks for an hour without a time, with one past or unreadable", () => {
    expect(maintenanceRetryAfter(null, NOW)).toBe(RETRY_AFTER_DEFAULT)
    expect(maintenanceRetryAfter("2026-11-17T09:00:00Z", NOW)).toBe(3600)
    expect(maintenanceRetryAfter("yarın", NOW)).toBe(3600)
  })
})
