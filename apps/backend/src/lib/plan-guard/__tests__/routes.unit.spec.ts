import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { JOB_TYPE_KEYS } from "../../../workflows/async-job/types"
import { PLAN_OPEN, PLAN_OPEN_JOBS, decidePlanWrite } from ".."

/**
 * adr/0061 Ek C15: every admin write route the app serves, ours and
 * Medusa's, has an explicit plan decision. A new route without one fails
 * here, not in a restricted shop: it must fall under an allow-list line or
 * a closed area. The allow-list names exact paths only, so nothing opens
 * by accident.
 */

const OURS = join(__dirname, "../../../api/admin")
const CORE = join(dirname(require.resolve("@medusajs/medusa/package.json")), "dist/api/admin")
// The plugins medusa-config loads register their admin routes too (review L2)
const LOYALTY = join(
  dirname(require.resolve("@medusajs/loyalty-plugin/package.json")),
  ".medusa/server/src/api/admin"
)

const OUR_HANDLER = /^export (?:async function|function|const|let) (POST|PUT|PATCH|DELETE)\b/gm
const CORE_HANDLER = /exports\.(POST|PUT|PATCH|DELETE)\s*=/g

function routes(root: string, file: string, handler: RegExp): string[] {
  const found = new Set<string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
      } else if (name === file) {
        const route = `/admin/${relative(root, dir)}`.replace(/\[(\w+)\]/g, ":$1")
        for (const [, method = ""] of readFileSync(path, "utf8").matchAll(handler)) {
          found.add(`${method} ${route}`)
        }
      }
    }
  }
  walk(root)
  return [...found].sort()
}

const ours = routes(OURS, "route.ts", OUR_HANDLER)
const core = routes(CORE, "route.js", CORE_HANDLER)
const loyalty = routes(LOYALTY, "route.js", CORE_HANDLER)

// A sample in place of each parameter, lower-cased as Express routes it
const sampleOf = (path: string) => path.replace(/:\w+/g, "x1")

/** The decision for `METHOD /path`, a job's type for the queue. */
const decisionOf = (route: string, jobType?: string) => {
  const [method = "", path = ""] = route.split(" ")
  return decidePlanWrite(method, sampleOf(path), jobType === undefined ? {} : { jobType })
}

describe("every admin write route has a plan decision", () => {
  it("finds the routes", () => {
    expect(ours.length).toBeGreaterThan(200)
    expect(core.length).toBeGreaterThan(250)
    expect(loyalty.length).toBeGreaterThan(4)
  })

  it.each([
    ["ours", ours],
    ["Medusa's", core],
    ["the loyalty plugin's", loyalty],
  ])("decides each of %s explicitly", (_, list) => {
    expect(list.filter((route) => decisionOf(route).reason === "unlisted")).toEqual([])
  })

  it("opens a route only by its own line, never through a sibling's parameter", () => {
    // `/admin/orders/:id` must not open a future `POST /admin/orders/bulk` (review L2)
    const template = (path: string) => path.replace(/:\w+/g, ":")
    const own = (route: string) => {
      const [method = "", path = ""] = route.split(" ")
      return PLAN_OPEN.some(
        (rule) =>
          (rule.methods === "*" || rule.methods.includes(method as never)) &&
          template(rule.path) === template(path)
      )
    }
    const opened = [...ours, ...core, ...loyalty].filter((route) => decisionOf(route).allowed)
    expect(opened.length).toBeGreaterThan(50)
    expect(opened.filter((route) => !own(route))).toEqual([])
    // The matcher alone would open such a sibling; this test is what stops it landing
    expect(decidePlanWrite("POST", "/admin/orders/bulk").allowed).toBe(true)
    expect(own("POST /admin/orders/bulk")).toBe(false)
  })

  it("opens only exact paths, each a route the app has", () => {
    const known = new Set([...ours, ...core, ...loyalty].map((route) => route.split(" ")[1]))
    for (const rule of PLAN_OPEN) {
      expect(rule.path.endsWith("*")).toBe(false)
      expect(known.has(rule.path)).toBe(true)
    }
  })

  it("decides every long task: exports run, anything that writes does not", () => {
    // A new job type is a decision too: it is listed here or in PLAN_OPEN_JOBS
    const closedJobs = [
      "catalog.bulk_edit",
      "catalog.description_facts",
      "catalog.import",
      "content.link_rewrite",
      "migration.invites",
      "migration.run",
      "migration.sitemap",
      "migration.urls",
      "promotion.codes",
      "seo.audit",
      "seo.sitemap",
      "seo.url_style",
      "tr_address.sync",
    ]
    expect([...PLAN_OPEN_JOBS, ...closedJobs].sort()).toEqual([...JOB_TYPE_KEYS].sort())
    for (const job of JOB_TYPE_KEYS) {
      expect(decisionOf("POST /admin/async-jobs", job).allowed).toBe(PLAN_OPEN_JOBS.has(job))
    }
    expect(decisionOf("POST /admin/async-jobs").allowed).toBe(false)
  })
})

describe("the plan guard's allow-list", () => {
  it.each([
    // Existing orders' operations
    "POST /admin/orders/:id",
    "POST /admin/orders/:id/cancel",
    "POST /admin/orders/:id/fulfillments",
    "POST /admin/orders/:id/ship",
    "POST /admin/orders/:id/refunds",
    "POST /admin/orders/:id/return-requests",
    "POST /admin/return-requests/:id/approve",
    "POST /admin/invoices/:id/retry",
    "POST /admin/orders/:id/bank-transfer/confirm",
    // Stock, KVKK, exports, one's own account, taking access away
    "POST /admin/inventory-items/:id/location-levels/:location_id",
    "POST /admin/inventory-items/location-levels/batch",
    "POST /admin/privacy-requests/:id/erase",
    "POST /admin/customers/:id/consents",
    "POST /admin/order-board/export",
    "POST /admin/staff/me/profile",
    "POST /admin/staff/me/password",
    "DELETE /admin/staff/members/:id",
    "POST /admin/api-access/:id/revoke",
    // Review M1: stopping what still goes out
    "POST /admin/bulk-messages/:id/pause",
    "POST /admin/bulk-messages/:id/cancel",
    "DELETE /admin/google",
  ])("keeps %s open", (route) => {
    expect(decisionOf(route)).toEqual({ allowed: true, reason: "open" })
  })

  it.each([
    // Catalog, campaigns, settings, bulk messaging, new staff, content, storefront
    "POST /admin/products",
    "POST /admin/products/:id",
    "DELETE /admin/products/:id",
    "POST /admin/products/:id/duplicate",
    "POST /admin/product-categories",
    "POST /admin/collections",
    "POST /admin/media",
    "POST /admin/uploads",
    "POST /admin/catalog/imports",
    "POST /admin/migrations",
    "POST /admin/inventory-items",
    "POST /admin/promotions",
    "POST /admin/campaigns",
    "POST /admin/payment-links",
    "POST /admin/platform-settings/:section",
    "POST /admin/features/:key",
    "POST /admin/bulk-messages/:id/send",
    "POST /admin/staff/invites",
    "POST /admin/staff/members/:id",
    "POST /admin/invites",
    "POST /admin/content",
    "POST /admin/storefront-layout/publish",
    "POST /admin/storefront-menus",
    "PUT /admin/seo/:entity_type/:entity_id",
    "POST /admin/maintenance/bypass",
    "POST /admin/customers/:id",
    "POST /admin/draft-orders",
    "POST /admin/returns",
    // Review M1, L2: only the stop actions and the disconnect; the loyalty plugin closed
    "POST /admin/bulk-messages/:id/resume",
    "DELETE /admin/google/reviews",
    "POST /admin/google/merchant/sync",
    "POST /admin/gift-cards",
    "POST /admin/store-credit-accounts/:id/credit",
  ])("closes %s", (route) => {
    expect(decisionOf(route)).toEqual({ allowed: false, reason: "closed" })
  })

  it("closes a write nobody decided (default closed)", () => {
    expect(decidePlanWrite("POST", "/admin/something-new")).toEqual({
      allowed: false,
      reason: "unlisted",
    })
    expect(decidePlanWrite("PATCH", "/admin/orders/x1")).toEqual({
      allowed: false,
      reason: "closed",
    })
  })

  it("reads everything, the plan included", () => {
    for (const path of ["/admin/plan", "/admin/products", "/admin/staff/me", "/admin/orders/x1"]) {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        expect(decidePlanWrite(method, path)).toEqual({ allowed: true, reason: "read" })
      }
    }
  })

  it("opens an allowed path in its raw form only", () => {
    expect(decidePlanWrite("POST", "/admin/staff/me/profile").allowed).toBe(true)
    expect(decidePlanWrite("POST", "/admin/staff/me/%70rofile").allowed).toBe(false)
    expect(decidePlanWrite("POST", "/admin/orders/x1/cancel/extra").allowed).toBe(false)
  })
})
