import { describe, expect, it } from "vitest"
import type { Me } from "@/features/auth/api"
import { standingOf } from "@/features/auth/standing"
import { activeKey, navFor } from "./navigation"

const keys = (role: Parameters<typeof navFor>[0]) =>
  navFor(role).flatMap((group) => group.items.map((item) => item.key))

describe("the control plane's menu", () => {
  it("shows the staff and the audit log to an owner only (the API decides again)", () => {
    expect(keys("owner")).toEqual(expect.arrayContaining(["dashboard", "staff", "audit"]))
    for (const role of ["operator", "finance", "readonly", null] as const) {
      expect(keys(role)).not.toContain("staff")
      expect(keys(role)).not.toContain("audit")
    }
  })

  it("opens the shops and packages to every role, the sections still to come unreachable", () => {
    for (const role of ["owner", "operator", "finance", "readonly"] as const) {
      const platform = navFor(role).find((group) => group.key === "platform")
      expect(platform?.items.map((item) => [item.key, item.to])).toEqual([
        ["shops", "/tenants"],
        ["packages", "/packages"],
        ["payments", undefined],
        ["releases", undefined],
      ])
    }
  })

  it("lights one item for a page", () => {
    expect(activeKey("/")).toBe("dashboard")
    expect(activeKey("/staff")).toBe("staff")
    expect(activeKey("/tenants")).toBe("shops")
    expect(activeKey("/tenants/ten_01")).toBe("shops")
    expect(activeKey("/packages")).toBe("packages")
    expect(activeKey("/audit-log")).toBe("audit")
    expect(activeKey("/account")).toBe("account")
  })
})

const me = (fields: Partial<Me>): Me => ({
  id: "user_1",
  email: "a@quant.test",
  first_name: null,
  last_name: null,
  role: "owner",
  pending: false,
  enrol_by: null,
  enrolment_token_required: false,
  mfa: { required: true, enabled: true, passed: true },
  ...fields,
})

describe("where a signed-in member stands (the route guard)", () => {
  it("lets a granted member whose session passed 2FA through", () => {
    expect(standingOf(me({}))).toBe("through")
  })

  it("leads a new member, a reset one and one without a factor to the setup", () => {
    expect(standingOf(me({ pending: true }))).toBe("setup")
    expect(standingOf(me({ mfa: { required: true, enabled: false, passed: false } }))).toBe("setup")
  })

  it("signs a session that has not passed 2FA out, to sign in with the code", () => {
    expect(standingOf(me({ mfa: { required: true, enabled: true, passed: false } }))).toBe(
      "sign-in-again"
    )
  })
})
