import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { OWNER_ONLY, PRIVATE } from "../../staff/permission-rules"
import { matches } from "../../staff/permissions"
import { decideSupport } from "../permissions"

/**
 * Every admin route the shop serves, ours and Medusa's, decided for a
 * support session (security review M-B): the ones it reaches are listed
 * in the snapshot, so a route newly reached shows in review; none of them
 * is an owner-only or private route but the looks, samples and writing help.
 */

const OURS = join(__dirname, "../../../api/admin")
const MEDUSA = join(dirname(require.resolve("@medusajs/medusa/package.json")), "dist/api/admin")
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const HANDLER =
  /export (?:async function|const|function) (GET|POST|PUT|PATCH|DELETE)\b|exports\.(GET|POST|PUT|PATCH|DELETE) =/g

function routeFiles(dir: string, name: RegExp): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      return entry === "__tests__" ? [] : routeFiles(path, name)
    }
    return name.test(entry) ? [path] : []
  })
}

const routesIn = (root: string, name: RegExp) =>
  routeFiles(root, name).flatMap((file) => {
    const path = `/admin/${relative(root, dirname(file))}`
      .replace(/\[(\w+)\]/g, ":$1")
      .replace(/\/$/, "")
      .toLowerCase()
    const methods = new Set(
      [...readFileSync(file, "utf8").matchAll(HANDLER)].map(([, a, b]) => a ?? b ?? "")
    )
    return METHODS.filter((method) => methods.has(method)).map((method) => ({ method, path }))
  })

const sample = (path: string) => path.replace(/:(\w+)/g, "x_1")

const ROUTES = [...routesIn(OURS, /^route\.ts$/), ...routesIn(MEDUSA, /^route\.js$/)]
const reached = ROUTES.filter(({ method, path }) => decideSupport(method, sample(path)).allowed)
// Who one is: every signed-in caller's (`SELF`), answered for support by its own middleware
const SELF_PATHS = new Set(["/admin/users/me", "/admin/staff/me"])
const listed = (rules: typeof OWNER_ONLY, method: string, path: string) =>
  matches(rules, method, sample(path), {})

describe("every admin route decided for a support session", () => {
  it("finds the routes", () => {
    expect(ROUTES.length).toBeGreaterThan(300)
  })

  it("reaches only the listed routes", () => {
    const names = [...new Set(reached.map(({ method, path }) => `${method} ${path}`))].sort()
    expect(names).toMatchSnapshot()
  })

  it("reaches no owner-only or private route but the looks, samples and writing help", () => {
    const allowedPrivate =
      /^\/admin\/(storefront-designs|storefront-presets|sample-catalog|ai\/suggestions|ai\/seo-fill)/
    const leaks = reached.filter(
      ({ method, path }) =>
        (listed(OWNER_ONLY, method, path) || listed(PRIVATE, method, path)) &&
        !allowedPrivate.test(path) &&
        !SELF_PATHS.has(path)
    )
    expect(leaks).toEqual([])
  })

  it("reaches no money, people or export route", () => {
    const sensitive =
      /refund|capture|mark-as-paid|bank-transfer|export|reveal|privacy|staff|users|invites|credentials|api-keys|webhooks|wholesale|promotions|draft-orders|payment|gift-card|bulk-messages|legal-documents|audit-log|migrations|support-access/
    expect(reached.filter(({ method, path }) => method !== "GET" && sensitive.test(path))).toEqual(
      []
    )
  })
})
