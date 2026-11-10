import { authIdentityField, authRouteKind } from "../auth-routes"
import { isValidRequestId } from "../headers"
import {
  decodedSegment,
  isAmbiguousTarget,
  routePathKeepingCaseOf,
  routePathOf,
  targetPath,
} from "../path"

describe("routePathOf", () => {
  it("reads the path as Express routes it", () => {
    expect(routePathOf("/ADMIN/Products//?q=1")).toBe("/admin/products")
    expect(routePathOf("///")).toBe("/")
    expect(routePathOf("http://evil.example/Admin/Products")).toBe("/admin/products")
    expect(routePathOf("/health#x")).toBe("/health")
  })

  it("keeps the case when asked, for IDs", () => {
    expect(routePathKeepingCaseOf("/admin/products/prod_01JABC/")).toBe(
      "/admin/products/prod_01JABC"
    )
  })

  it("trims a long run of slashes in linear time", () => {
    const start = performance.now()
    routePathOf(`/auth/${"/".repeat(16_000)}x`)
    routePathOf(`/auth${"/".repeat(16_000)}`)
    expect(performance.now() - start).toBeLessThan(50)
  })

  it("strips only the query", () => {
    expect(targetPath("/a/b?c=d?e")).toBe("/a/b")
  })
})

describe("isAmbiguousTarget", () => {
  it.each([
    "/auth\\customer\\emailpass\\reset-password#",
    "/admin/products#x",
    "/admin\\products",
    "/admin/gift-cards/../orders",
    "/admin/gift-cards/%2e%2E/orders",
    "/admin/./orders",
    "/admin/webhooks/%2E",
  ])("refuses %s", (target) => {
    expect(isAmbiguousTarget(target)).toBe(true)
  })

  it("lets an ordinary path through, encoded characters and a dotted query included", () => {
    expect(isAmbiguousTarget("/admin/products/prod%5F01.v2?q=%2e%2e/../")).toBe(false)
  })

  it("decodes a segment, keeping a malformed one as written", () => {
    expect(decodedSegment("%2e")).toBe(".")
    expect(decodedSegment("%E0%A4%A")).toBe("%E0%A4%A")
  })
})

describe("authRouteKind", () => {
  it.each([
    ["/auth/token/refresh", "token_refresh"],
    ["/auth/session", "session"],
    ["/auth/user/emailpass/register", "register"],
    ["/auth/user/emailpass/reset-password", "password_reset"],
    ["/auth/user/emailpass/update", "auth_default"],
    ["/auth/user/google/callback", "auth_default"],
    ["/auth/user/emailpass", "login"],
    ["/auth/anything/else/entirely", "login"],
  ])("reads %s as %s", (path, kind) => {
    expect(authRouteKind(path)).toBe(kind)
  })

  it("names the body field of the targeted account", () => {
    expect(authIdentityField("/auth/user/emailpass")).toBe("email")
    expect(authIdentityField("/auth/user/emailpass/reset-password")).toBe("identifier")
    expect(authIdentityField("/auth/verification/request")).toBe("entity_id")
  })
})

describe("isValidRequestId", () => {
  it("accepts a UUID and refuses a forged log line", () => {
    expect(isValidRequestId("3f2b8c1e-6a4d-4e8b-9c1f-2a3b4c5d6e7f")).toBe(true)
    expect(isValidRequestId("abcdefgh\nINFO forged")).toBe(false)
    expect(isValidRequestId(["abcdefgh"])).toBe(false)
  })
})
