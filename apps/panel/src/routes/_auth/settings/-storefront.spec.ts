import { isRedirect } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { Route } from "./storefront"

/** The redirect the old Settings > Storefront address throws for this search. */
function redirectFor(search: Record<string, unknown>) {
  const beforeLoad = Route.options.beforeLoad as unknown as (context: {
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

describe("the old Settings > Storefront address", () => {
  it("opens Storefront > Preferences on the tab it names", () => {
    expect(redirectFor({ part: "maintenance" })).toMatchObject({
      to: "/storefront/preferences",
      search: { part: "maintenance" },
    })
  })

  it("drops a part that moved to the theme editor, so the first tab opens", () => {
    // The full search still holds what no route validates (TanStack keeps the raw keys)
    const options = redirectFor({ part: "swatches" })
    expect(options.to).toBe("/storefront/preferences")
    expect(options.search).toEqual({})
  })
})
