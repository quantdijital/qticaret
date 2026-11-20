import { isRedirect } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { Route } from "@/routes/_auth/categories/index"

type BeforeLoad = (context: { search: { q?: string; selected?: string } }) => unknown

/** What `/categories?…` does before it draws: the thrown redirect, if any. */
function open(search: { q?: string; selected?: string }): unknown {
  const beforeLoad = Route.options.beforeLoad as unknown as BeforeLoad
  try {
    beforeLoad({ search })
    return null
  } catch (thrown) {
    return thrown
  }
}

describe("links to the old categories view", () => {
  it("sends a chosen category's old link to its own page", () => {
    const thrown = open({ selected: "pcat_1" })

    expect(isRedirect(thrown)).toBe(true)
    expect((thrown as { options: unknown }).options).toMatchObject({
      to: "/categories/$id",
      params: { id: "pcat_1" },
      replace: true,
    })
  })

  it("keeps the list for a search and for the new category's dialog", () => {
    expect(open({ q: "bicak" })).toBeNull()
    expect(open({ selected: "new" })).toBeNull()
  })

  it("reads the old `selected` from the address", () => {
    const schema = Route.options.validateSearch as unknown as { parse: (input: unknown) => unknown }
    expect(schema.parse({ selected: "pcat_1", q: 7 })).toEqual({ selected: "pcat_1" })
  })
})
