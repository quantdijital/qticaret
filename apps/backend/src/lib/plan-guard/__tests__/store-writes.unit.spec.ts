import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * Every write of ours under the Store API, with what a suspended shop does
 * with it (adr/0061 §5.5; security review of the cart guard). A new write
 * route fails here until someone decides:
 * - `cart`: under `/store/carts`, refused by the wildcard guard
 *   (`refuseSuspendedCartWrite`, payment-routes.ts)
 * - `guarded`: outside it, refused by the same guard on its own route
 * - `read`: a read by POST, open (the guard lets it through by name)
 * - `open`: not a sale: the shopper's account, consents, questions,
 *   reviews, an order already placed; it stays open while suspended
 */
const STORE_WRITES: Readonly<Record<string, "cart" | "guarded" | "read" | "open">> = {
  // adr/0076 Ek 2026-11-23: a call-me request, open like the contact form
  "POST /store/booking-requests": "open",
  "POST /store/cart-reminders/redeem": "guarded",
  "POST /store/carts/:id/age-declaration": "cart",
  "POST /store/carts/:id/order-note": "cart",
  "POST /store/carts/:id/bookings": "cart",
  "DELETE /store/carts/:id/bookings/:slot_id": "cart",
  "POST /store/carts/:id/travelers": "cart",
  "POST /store/carts/:id/consents": "cart",
  "POST /store/carts/:id/legal-consents": "cart",
  "POST /store/carts/:id/line-items/:line_id/addons": "cart",
  "POST /store/carts/:id/line-items/:line_id/gift": "cart",
  "POST /store/carts/:id/order-access": "read",
  "POST /store/carts/:id/payment-session": "cart",
  "POST /store/carts/:id/source": "cart",
  "POST /store/carts/:id/tracking": "cart",
  "POST /store/consents/confirm": "open",
  "POST /store/consents/cookies": "open",
  "POST /store/consents/unsubscribe": "open",
  "POST /store/contact-messages": "open",
  "POST /store/customers/me/billing-profile": "open",
  "POST /store/customers/me/consents": "open",
  "POST /store/customers/me/migration-claim": "open",
  "POST /store/customers/me/privacy-requests": "open",
  "POST /store/customers/me/wishlist": "open",
  "DELETE /store/customers/me/wishlist/:id": "open",
  "POST /store/gift-cards/balance": "read",
  "POST /store/newsletter": "open",
  "POST /store/order-lookup": "read",
  // adr/0080 §7: a pop-up's counters, numbers only; a suspended shop shows no pop-up anyway
  "POST /store/popups/:id/events": "open",
  "POST /store/orders/:id/bookings/cancel": "open",
  "POST /store/orders/:id/cancel": "open",
  "POST /store/orders/:id/returns": "open",
  "POST /store/payment-links/:token/cart": "guarded",
  "POST /store/product-questions/:id/answers": "open",
  "POST /store/products/:id/questions": "open",
  "POST /store/products/:id/reviews": "open",
  "POST /store/products/:id/reviews/photos": "open",
  // adr/0077 §7: a search read by POST, its sentence in the body
  "POST /store/search/interpret": "read",
  "POST /store/seo/not-found": "open",
  "POST /store/stock-alerts": "open",
  "POST /store/stock-alerts/confirm": "open",
}

const STORE = join(__dirname, "../../../api/store")
const HANDLER = /^export (?:async function|function|const|let) (POST|PUT|PATCH|DELETE)\b/gm

function storeWrites(): Set<string> {
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

describe("the Store API's writes while suspended (adr/0061 §5.5)", () => {
  it("has a decision for every write route of ours, and none for a route that is gone", () => {
    const found = storeWrites()
    expect([...found].filter((route) => !(route in STORE_WRITES)).sort()).toEqual([])
    expect(
      Object.keys(STORE_WRITES)
        .filter((route) => !found.has(route))
        .sort()
    ).toEqual([])
  })

  it("keeps every cart write under the wildcard guard's path", () => {
    for (const [route, decision] of Object.entries(STORE_WRITES)) {
      const underCarts = route.split(" ")[1]?.startsWith("/store/carts") === true
      if (decision === "cart") {
        expect(underCarts).toBe(true)
      }
    }
  })
})
