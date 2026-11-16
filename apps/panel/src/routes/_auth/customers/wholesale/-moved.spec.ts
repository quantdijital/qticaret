import { isRedirect } from "@tanstack/react-router"
import { describe, expect, it } from "vitest"
import { Route as Account } from "./$id"
import { Route as List } from "./index"
import { Route as Orders } from "./orders"
import { Route as Tier } from "./tiers/$id"
import { Route as Tiers } from "./tiers/index"

/** The redirect an old Müşteriler > Toptancılar address throws for this search and these params. */
function redirectFor(
  route: { options: { beforeLoad?: unknown } },
  { search = {}, params = {} }: { search?: object; params?: object } = {}
) {
  const beforeLoad = route.options.beforeLoad as (context: {
    search: object
    params: object
  }) => void
  try {
    beforeLoad({ search, params })
  } catch (thrown) {
    if (isRedirect(thrown)) {
      return thrown.options
    }
    throw thrown
  }
  throw new Error("no redirect")
}

describe("the old /customers/wholesale addresses (bookmarks, alerts already sent)", () => {
  it("open the wholesalers at /wholesale, their filters kept", () => {
    expect(redirectFor(List, { search: { q: "kaya", status: "active", page: 2 } })).toMatchObject({
      to: "/wholesale",
      search: { q: "kaya", status: "active", page: 2 },
      replace: true,
    })
  })

  it("open a wholesaler at /wholesale/$id", () => {
    expect(redirectFor(Account, { params: { id: "wacc_1" } })).toMatchObject({
      to: "/wholesale/$id",
      params: { id: "wacc_1" },
    })
  })

  it("open the levels and one level under /wholesale/tiers", () => {
    expect(redirectFor(Tiers, { search: { page: 3 } })).toMatchObject({
      to: "/wholesale/tiers",
      search: { page: 3 },
    })
    expect(redirectFor(Tier, { params: { id: "wst_1" } })).toMatchObject({
      to: "/wholesale/tiers/$id",
      params: { id: "wst_1" },
    })
  })

  it("open the wholesale orders at /wholesale/orders with the alert's search", () => {
    expect(redirectFor(Orders, { search: { q: "1042", stage: "all" } })).toMatchObject({
      to: "/wholesale/orders",
      search: { q: "1042", stage: "all" },
    })
  })
})
