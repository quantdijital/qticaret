import { readFileSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(300 * 1000)

const API = join(__dirname, "../../src/api")
const HANDLER = /export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g

interface Route {
  path: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
}

/** Every handler our own route files export under an area, a path parameter as "x". */
function routesOf(area: string): Route[] {
  const found: Route[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name === "route.ts") {
        const segments = relative(API, dir).split(sep)
        const path = `/${segments.map((part) => (/^\[.+\]$/.test(part) ? "x" : part)).join("/")}`
        for (const [, method] of readFileSync(full, "utf8").matchAll(HANDLER)) {
          found.push({ path, method: method as Route["method"] })
        }
      }
    }
  }
  walk(join(API, area))
  return found
}

// Open before a sign-in by design: the invitation's own token proves it (adr/0040 §4)
const PUBLIC_ADMIN = new Set(["POST /admin/staff/invites/info", "POST /admin/staff/invites/accept"])

/**
 * F15.2 (docs/04): our own routes, read from the files, each asked without
 * credentials. A new route that forgets its guard fails here, not in a
 * pentest: every admin route answers 401, every customer route 401 with
 * the shop's key, every store route needs the key, every provider hook
 * refuses an unsigned call.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
    })

    const call = (route: Route, headers: Record<string, string> = {}) =>
      settle(
        http.request({
          url: route.path,
          method: route.method,
          headers: { "content-type": "application/json", ...headers },
          ...(route.method === "GET" || route.method === "DELETE" ? {} : { data: {} }),
        })
      )

    const answers = async (routes: Route[], headers?: Record<string, string>) => {
      const out: string[] = []
      for (const route of routes) {
        const response = await call(route, headers)
        out.push(`${route.method} ${route.path} ${String(response.status)}`)
      }
      return out
    }

    it("answers 401 to every admin route without a sign-in", async () => {
      const routes = routesOf("admin")
      expect(routes.length).toBeGreaterThan(150)
      const open = (
        await answers(routes.filter((r) => !PUBLIC_ADMIN.has(`${r.method} ${r.path}`)))
      ).filter((line) => !line.endsWith(" 401"))
      expect(open).toEqual([])
    })

    it("answers 401 to every customer route without a sign-in, the shop's key given", async () => {
      const routes = routesOf("store/customers/me")
      expect(routes.length).toBeGreaterThan(4)
      const open = (await answers(routes, storefront.headers)).filter(
        (line) => !line.endsWith(" 401")
      )
      expect(open).toEqual([])
    })

    it("serves no store route without the shop's publishable key", async () => {
      const open = (await answers(routesOf("store"))).filter((line) => !/ 4\d\d$/.test(line))
      expect(open).toEqual([])
    })

    it("refuses an unsigned call to every provider hook", async () => {
      const routes = routesOf("hooks")
      expect(routes.length).toBeGreaterThan(2)
      const taken = (await answers(routes)).filter((line) => !/ 4\d\d$/.test(line))
      expect(taken).toEqual([])
    })
  },
})
