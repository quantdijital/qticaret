import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * adr/0061 Ek C19 L2: the plan guard sits on `/admin` (routes.unit.spec.ts)
 * and the storefront's checkout (`refuseSuspendedCheckout`); a route
 * elsewhere is reached without either. Every such route the app serves has
 * its decision written here, so a new one fails until someone decides:
 *
 * - `checks`: the handler asks `planModeFor` itself (its test says how)
 * - `open`: it must work in any status: a provider's callback (§5.5), the
 *   control plane's document (the way a restriction is lifted), a
 *   shopper's legal right (unsubscribing, a consent), or development only
 */

type Decision = "checks" | "open"

const DECISIONS: Record<string, Decision> = {
  // A shopper's double opt-in for a consent and a stock alert: their own request
  "GET /consents/confirm": "open",
  "POST /consents/confirm": "open",
  "GET /stock-alerts/confirm": "open",
  "POST /stock-alerts/confirm": "open",
  // Unsubscribing is the shopper's right whatever the shop's plan (İYS)
  "GET /unsubscribe": "open",
  "POST /unsubscribe": "open",
  // Development only (its own guard)
  "GET /dev/storefront-key": "open",
  // A suspended shop's feeds answer 503 (Ek C19 L1)
  "GET /feeds/:token/:target": "checks",
  // A restricted or suspended shop connects no Google account (Ek C19 L2)
  "GET /google/callback": "checks",
  // The control plane's document: the only way a restriction is lifted
  "POST /hooks/control-plane/plan": "open",
  // Payment, shipping and mail providers' callbacks settle what already started (§5.5)
  "POST /hooks/iyzico/callback": "open",
  "POST /hooks/paytr": "open",
  "POST /hooks/resend": "open",
  // adr/0072: BirFatura invoicing sales already made; issuing the tax document is a
  // legal duty (VUK) that outlives a plan suspension, so its pull stays open
  "POST /hooks/birfatura/api/orderStatus": "open",
  "POST /hooks/birfatura/api/paymentMethods": "open",
  "POST /hooks/birfatura/api/orders": "open",
  "POST /hooks/birfatura/api/orderCargoUpdate": "open",
  "POST /hooks/birfatura/api/invoiceLinkUpdate": "open",
}

const API = join(__dirname, "../../../api")
// `/admin` has its own inventory; `/store` has its own too (store-writes.unit.spec.ts:
// what a suspended shop refuses there)
const COVERED_ELSEWHERE = new Set(["admin", "store"])
const HANDLER = /^export (?:async function|function|const|let) (GET|POST|PUT|PATCH|DELETE)\b/gm

function routesOutsideAdmin(): Map<string, string> {
  const found = new Map<string, string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (dir === API && COVERED_ELSEWHERE.has(name)) {
          continue
        }
        walk(path)
      } else if (name === "route.ts") {
        const route = `/${relative(API, dir)}`.replace(/\[(\w+)\]/g, ":$1")
        const source = readFileSync(path, "utf8")
        for (const [, method = ""] of source.matchAll(HANDLER)) {
          found.set(`${method} ${route}`, source)
        }
      }
    }
  }
  walk(API)
  return found
}

describe("routes outside /admin and the plan (Ek C19 L2)", () => {
  const routes = routesOutsideAdmin()

  it("finds them", () => {
    expect(routes.size).toBeGreaterThanOrEqual(Object.keys(DECISIONS).length)
  })

  it("has a decision for every one, and none for a route that is gone", () => {
    expect([...routes.keys()].filter((route) => !(route in DECISIONS)).sort()).toEqual([])
    expect(Object.keys(DECISIONS).filter((route) => !routes.has(route))).toEqual([])
  })

  it("asks the plan in each route that says it does", () => {
    const silent = Object.entries(DECISIONS)
      .filter(([, decision]) => decision === "checks")
      .filter(([route]) => !/\bplanModeFor\(/.test(routes.get(route) ?? ""))
      .map(([route]) => route)
    expect(silent).toEqual([])
  })
})
