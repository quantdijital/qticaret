import { isRedirect } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { Route as Preferences } from "../storefront/preferences"
import { Route as Storefront } from "./storefront"

/** The redirect an old address throws for this search. */
function redirectFor(
  route: { options: { beforeLoad?: unknown } },
  search: Record<string, unknown>
) {
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

describe("the old Storefront > Preferences address (out of the sidebar, 2026-11-16)", () => {
  it("opens the theme editor with its preferences panel for the contact and info pages", () => {
    for (const part of [undefined, "contact", "infoPages"]) {
      expect(redirectFor(Preferences, part ? { part } : {})).toMatchObject({
        to: "/storefront/editor",
        search: { open: "preferences" },
        replace: true,
      })
    }
  })

  it("opens Settings > Maintenance for maintenance", () => {
    expect(redirectFor(Preferences, { part: "maintenance" })).toMatchObject({
      to: "/settings/maintenance",
    })
  })
})

describe("the older Settings > Storefront address", () => {
  it("lands where the part it names went", () => {
    expect(redirectFor(Storefront, { part: "maintenance" })).toMatchObject({
      to: "/settings/maintenance",
    })
    expect(redirectFor(Storefront, { part: "contact" })).toMatchObject({
      to: "/storefront/editor",
      search: { open: "preferences" },
    })
  })

  it("opens the editor's preferences for a part that moved to the theme editor earlier", () => {
    // The full search still holds what no route validates (TanStack keeps the raw keys)
    expect(redirectFor(Storefront, { part: "swatches" })).toMatchObject({
      to: "/storefront/editor",
      search: { open: "preferences" },
    })
  })
})
