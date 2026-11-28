import { requireUserActor } from "../actor"
import { STOREFRONT_DESIGN_ROUTES } from "../storefront-design-routes"
import { STOREFRONT_MENU_ROUTES } from "../storefront-menu-routes"

interface Route {
  matcher: string
  methods: readonly string[]
  middlewares: readonly unknown[]
}

const ROUTES = [...STOREFRONT_MENU_ROUTES, ...STOREFRONT_DESIGN_ROUTES] as Route[]

const routeOf = (method: string, matcher: string): Route | undefined =>
  ROUTES.find((route) => route.matcher === matcher && route.methods.includes(method))

/**
 * The theme editor's writes that keep the draft first as an automatic save
 * (adr/0064 Ek 2026-11-17) are people's, never a key's, and rate limited per
 * staff member: the actor check first, then the limit, then the body.
 */
describe("the storefront's draft-replacing routes", () => {
  const PEOPLE_ONLY: [string, string][] = [
    ["POST", "/admin/storefront-layout/discard"],
    ["POST", "/admin/storefront-layout/revisions/:revision/restore"],
    ["POST", "/admin/storefront-presets/:pack/:code/apply"],
    ["POST", "/admin/storefront-designs/:id/apply"],
    ["POST", "/admin/storefront-designs"],
    ["POST", "/admin/storefront-designs/:id"],
    ["DELETE", "/admin/storefront-designs/:id"],
  ]

  it.each(PEOPLE_ONLY)(
    "%s %s refuses a key first, then counts per staff member",
    (method, path) => {
      const route = routeOf(method, path)
      expect(route).toBeDefined()
      expect(route?.middlewares[0]).toBe(requireUserActor)
      // The rate limit right after: one middleware, not the body's validation
      expect(route?.middlewares.length).toBeGreaterThanOrEqual(2)
    }
  )

  it("asks a person for a look's fit (owner, 2026-11-28), with no apply budget spent", () => {
    const route = routeOf("GET", "/admin/storefront-presets/:pack/:code/fit")
    expect(route?.middlewares).toEqual([requireUserActor])
  })

  it("leaves publish and preview as they were: one body check, no actor rule of their own", () => {
    for (const path of ["/admin/storefront-layout/publish", "/admin/storefront-layout/preview"]) {
      const route = routeOf("POST", path)
      expect(route?.middlewares).toHaveLength(1)
      expect(route?.middlewares).not.toContain(requireUserActor)
    }
  })

  it("takes the whole design up to a megabyte (adr/0073 §1), past Express's 100 kB", () => {
    const save = routeOf("POST", "/admin/storefront-layout") as
      (Route & { bodyParser?: { sizeLimit?: string } }) | undefined
    expect(save?.bodyParser?.sizeLimit).toBe("1mb")
  })

  it("limits a content page's live session read as the session's own (adr/0073 §5)", () => {
    const own = routeOf("GET", "/store/storefront-layout/session/:token")
    const page = routeOf("GET", "/store/storefront-layout/session/:token/pages/:id")
    expect(page?.middlewares).toHaveLength(1)
    expect(own?.middlewares).toHaveLength(1)
  })

  it("limits a content page's signed design link read (security review 2026-11-19, I3)", () => {
    const page = routeOf("GET", "/store/storefront-layout/preview/:token/pages/:id")
    expect(page?.middlewares).toHaveLength(1)
  })

  it("never lists discard twice (one middleware set per route)", () => {
    const discards = ROUTES.filter((route) => route.matcher === "/admin/storefront-layout/discard")
    expect(discards).toHaveLength(1)
  })
})
