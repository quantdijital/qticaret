import { routePathOf } from "@qticaret/server-kit"
import { isAllowedRoute } from "../route-allowlist"

const allowed = (target: string) => isAllowedRoute(routePathOf(target))

describe("isAllowedRoute", () => {
  it.each([
    "/health",
    "/auth/user/emailpass",
    "/auth/user/emailpass/reset-password",
    "/auth/session",
    "/auth/token/refresh",
    "/auth/mfa/challenges/authmfachal_01/verify",
    "/admin/cp",
    "/admin/cp/tenants/ten_01",
    "/tenant-api/v1/plan",
    "/ADMIN/CP/Tenants/",
    "/health?probe=1",
  ])("lets %s through", (target) => {
    expect(allowed(target)).toBe(true)
  })

  it.each([
    "/",
    "/app",
    "/admin",
    "/admin/products",
    "/ADMIN/Products/",
    "/admin/users",
    "/admin/api-keys",
    "/admin/cpx",
    "/admin/cp-tenants",
    "/store/products",
    "/store/carts",
    "/auth/customer/emailpass",
    "/auth/customer/emailpass/register",
    "/auth/userx/emailpass",
    "/auth/token",
    "/auth/mfa/factors",
    "/auth/mfa/factors/authmfa_01/verify",
    "/auth/mfa/recovery-codes",
    "/auth/mfa/challengesx",
    "/hooks/paytr",
    "/static/file.png",
    "/healthz",
    "/tenant-apix",
    "http://evil.example/admin/products",
  ])("refuses %s", (target) => {
    expect(allowed(target)).toBe(false)
  })
})
