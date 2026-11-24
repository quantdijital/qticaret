import { isRedirect } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { seoSearchSchema } from "@/features/seo/search"
import { Route as Overview } from "./index"
import { Route as Redirects } from "./redirects"
import { Route as SiteSearch } from "./search"

interface MovedRoute {
  options: { validateSearch?: unknown; beforeLoad?: unknown }
}

/** Where an old address sends this query, read as the router reads it (validated first). */
function redirectFor(route: MovedRoute, query: Record<string, unknown> = {}) {
  const validate = route.options.validateSearch as
    { parse: (raw: unknown) => Record<string, unknown> } | undefined
  const search = validate ? validate.parse(query) : {}
  const beforeLoad = route.options.beforeLoad as (context: {
    search: Record<string, unknown>
  }) => void
  try {
    beforeLoad({ search })
  } catch (thrown) {
    if (isRedirect(thrown)) {
      return thrown.options
    }
    throw thrown
  }
  throw new Error("no redirect")
}

describe("the old Pazarlama > SEO addresses (SEO moved to Settings, the owner, 2026-11-23)", () => {
  it("sends /seo to Settings > SEO's overview", () => {
    expect(redirectFor(Overview)).toEqual(
      expect.objectContaining({
        to: "/settings/seo",
        search: { part: "overview" },
        replace: true,
      })
    )
  })

  it("sends /seo/redirects to its tab, its list's filters kept", () => {
    const target = redirectFor(Redirects, { tab: "missing", q: "kupa", match: "prefix", page: "3" })
    expect(target).toMatchObject({ to: "/settings/seo", replace: true })
    expect(target.search).toEqual({
      part: "redirects",
      tab: "missing",
      q: "kupa",
      match: "prefix",
      page: 3,
    })
    // What the new address reads back is the same view
    expect(seoSearchSchema.parse(target.search)).toEqual(target.search)
  })

  it("sends a bare /seo/redirects to the tab's first list", () => {
    expect(redirectFor(Redirects).search).toEqual({ part: "redirects" })
  })

  it("sends /seo/search to the site search tab, its search and page kept", () => {
    expect(redirectFor(SiteSearch, { q: "tisort", page: "2" }).search).toEqual({
      part: "site-search",
      q: "tisort",
      page: 2,
    })
  })

  it("drops what the old screens never read", () => {
    expect(redirectFor(SiteSearch, { q: "tisort", tab: "missing", page: "x" }).search).toEqual({
      part: "site-search",
      q: "tisort",
    })
  })
})
