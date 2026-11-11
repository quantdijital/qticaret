import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { CP_ROUTES, decide, matchRoute } from "../route-table"
import type { Caller } from "../route-table"
import { CP_STAFF_ROLES } from "../roles"

const API_ROOT = join(__dirname, "../../../api")
const CP_ROOT = join(API_ROOT, "admin/cp")

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return routeFiles(path)
    }
    return name === "route.ts" ? [path] : []
  })
}

/** Each handler a route file exports, as the route table writes it. */
const handlers = routeFiles(CP_ROOT).flatMap((file) => {
  const source = readFileSync(file, "utf8")
  const path = `/${relative(API_ROOT, file).split(sep).slice(0, -1).join("/")}`.replace(
    /\[([^\]]+)\]/g,
    ":$1"
  )
  const isPublic = source.includes("export const AUTHENTICATE = false")
  return [...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map(
    ([, method]) => ({ method: method ?? "", path, isPublic })
  )
})

const staff = (role: Caller["role"], mfaPassed = true): Caller => ({ role, mfaPassed })

describe("the control plane's route table (adr/0061 §3.5)", () => {
  it("finds the route files", () => {
    expect(handlers.length).toBeGreaterThanOrEqual(CP_ROUTES.length)
  })

  it.each(handlers.map((each) => [each.method, each.path, each.isPublic] as const))(
    "has a decision for %s %s",
    (method, path, isPublic) => {
      const rule = CP_ROUTES.find((each) => each.method === method && each.path === path)

      expect(rule).toBeDefined()
      // A route without a session is exactly one the table calls public
      expect(rule?.access === "public").toBe(isPublic)
    }
  )

  it("names no route that has no file", () => {
    for (const rule of CP_ROUTES) {
      expect(handlers).toContainEqual(
        expect.objectContaining({ method: rule.method, path: rule.path })
      )
    }
  })

  it("lists each route once", () => {
    const keys = CP_ROUTES.map((rule) => `${rule.method} ${rule.path}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("matches the route a request names, its parameter kept as written", () => {
    const match = matchRoute("POST", "/admin/cp/staff/members/user_01ABC/deactivate")

    expect(match?.rule.path).toBe("/admin/cp/staff/members/:id/deactivate")
    expect(match?.params).toEqual({ id: "user_01ABC" })
    expect(matchRoute("POST", "/admin/cp/staff/invites")?.rule.path).toBe("/admin/cp/staff/invites")
    expect(matchRoute("HEAD", "/admin/cp/me")?.rule.method).toBe("GET")
    expect(matchRoute("GET", "/admin/cp/me/extra")).toBeNull()
    expect(matchRoute("PUT", "/admin/cp/me")).toBeNull()
  })

  it("refuses everyone a route it does not list", () => {
    for (const role of [...CP_STAFF_ROLES, null]) {
      expect(decide(matchRoute("GET", "/admin/cp/invoices")?.rule ?? null, staff(role))).toEqual({
        allowed: false,
        reason: "unlisted",
      })
    }
  })

  it("lets no one past their own setup before 2FA, and nobody without a role anywhere", () => {
    for (const rule of CP_ROUTES) {
      const before = decide(rule, staff("owner", false))
      const noRole = decide(rule, staff(null))
      if (rule.access === "public") {
        expect(before.allowed && noRole.allowed).toBe(true)
        continue
      }
      expect(before.allowed).toBe(rule.access === "setup")
      expect(noRole).toEqual({ allowed: false, reason: "no_role" })
    }
  })

  it("keeps the 2FA-free routes to who one is and the setup", () => {
    const setup = CP_ROUTES.filter((rule) => rule.access === "setup").map(
      (rule) => `${rule.method} ${rule.path}`
    )

    expect(setup.sort()).toEqual([
      "GET /admin/cp/me",
      "POST /admin/cp/me/mfa",
      "POST /admin/cp/me/mfa/verify",
    ])
  })

  it("gives the staff, the invitations and the audit log to the owner alone", () => {
    const ownerOnly = CP_ROUTES.filter((rule) => rule.path.startsWith("/admin/cp/staff")).concat(
      CP_ROUTES.filter((rule) => rule.path === "/admin/cp/audit-log")
    )
    for (const rule of ownerOnly) {
      for (const role of CP_STAFF_ROLES) {
        expect(decide(rule, staff(role)).allowed).toBe(role === "owner")
      }
    }
  })

  it("asks a step-up for every change that grants, keeps or shows access", () => {
    const stepUps = CP_ROUTES.filter((rule) => rule.stepUp).map(
      (rule) => `${rule.method} ${rule.path}`
    )

    expect(stepUps.sort()).toEqual([
      "DELETE /admin/cp/me/mfa",
      "DELETE /admin/cp/me/sessions/:id",
      "POST /admin/cp/billing-settings",
      "POST /admin/cp/keys/rewrap",
      "POST /admin/cp/keys/signing/prepare",
      "POST /admin/cp/keys/signing/retire",
      "POST /admin/cp/keys/signing/switch",
      "POST /admin/cp/me/mfa/recovery-codes",
      "POST /admin/cp/me/sessions/revoke-others",
      "POST /admin/cp/plans",
      "POST /admin/cp/plans/:id/price",
      "POST /admin/cp/staff/invites",
      "POST /admin/cp/staff/members/:id",
      "POST /admin/cp/staff/members/:id/deactivate",
      "POST /admin/cp/staff/members/:id/reactivate",
      "POST /admin/cp/staff/members/:id/reset-mfa",
      "POST /admin/cp/tenants",
      "POST /admin/cp/tenants/:id/charges/:charge_id/amount",
      "POST /admin/cp/tenants/:id/charges/:charge_id/pay",
      "POST /admin/cp/tenants/:id/charges/:charge_id/void",
      "POST /admin/cp/tenants/:id/charges/:charge_id/waive",
      "POST /admin/cp/tenants/:id/plan",
      "POST /admin/cp/tenants/:id/provisioning",
      "POST /admin/cp/tenants/:id/provisioning/apply-pack",
      "POST /admin/cp/tenants/:id/provisioning/invite",
      "POST /admin/cp/tenants/:id/provisioning/start",
      "POST /admin/cp/tenants/:id/provisioning/stop",
      "POST /admin/cp/tenants/:id/resume",
      "POST /admin/cp/tenants/:id/reveal-tckn",
      "POST /admin/cp/tenants/:id/subscription",
      "POST /admin/cp/tenants/:id/suspend",
    ])
  })

  const allowedRoles = (method: string, path: string) => {
    const rule = matchRoute(method, path)?.rule ?? null
    return CP_STAFF_ROLES.filter((role) => decide(rule, staff(role)).allowed)
  }

  it("lets every role read the shops and packages; changes are the operator's (C7)", () => {
    expect(allowedRoles("GET", "/admin/cp/tenants")).toEqual([...CP_STAFF_ROLES])
    expect(allowedRoles("GET", "/admin/cp/tenants/ten_1")).toEqual([...CP_STAFF_ROLES])
    expect(allowedRoles("GET", "/admin/cp/tenants/ten_1/activity")).toEqual([...CP_STAFF_ROLES])
    expect(allowedRoles("GET", "/admin/cp/plans")).toEqual([...CP_STAFF_ROLES])
    // C12: the sector packs are release data, read by all as the packages are
    expect(allowedRoles("GET", "/admin/cp/sector-packs")).toEqual([...CP_STAFF_ROLES])
    expect(matchRoute("GET", "/admin/cp/sector-packs")?.rule.stepUp).toBeUndefined()
    for (const [method, path] of [
      ["POST", "/admin/cp/tenants"],
      ["POST", "/admin/cp/tenants/ten_1"],
      ["POST", "/admin/cp/tenants/ten_1/contacts"],
      ["DELETE", "/admin/cp/tenants/ten_1/contacts/tenct_1"],
      ["POST", "/admin/cp/tenants/ten_1/domains/tendm_1/primary"],
      ["POST", "/admin/cp/tenants/ten_1/notes"],
      ["POST", "/admin/cp/tenants/ten_1/plan"],
      ["POST", "/admin/cp/tenants/ten_1/overrides"],
      ["DELETE", "/admin/cp/tenants/ten_1/overrides/products"],
    ] as const) {
      expect(allowedRoles(method, path)).toEqual(["owner", "operator"])
    }
  })

  it("checks a new shop's address for who may make one, no step-up, no audit (C11)", () => {
    const rule = matchRoute("GET", "/admin/cp/tenant-availability")?.rule

    expect(allowedRoles("GET", "/admin/cp/tenant-availability")).toEqual(["owner", "operator"])
    expect(rule?.stepUp).toBeUndefined()
    expect(rule?.auditRead).toBeUndefined()
    // Not under `/tenants/:id`: the word is never read as a shop's id
    expect(matchRoute("GET", "/admin/cp/tenants/availability")?.rule.path).toBe(
      "/admin/cp/tenants/:id"
    )
  })

  it("gives the company and its TCKN to finance too, packages to owner and finance (C7)", () => {
    expect(allowedRoles("POST", "/admin/cp/tenants/ten_1/company")).toEqual([
      "owner",
      "operator",
      "finance",
    ])
    expect(allowedRoles("POST", "/admin/cp/tenants/ten_1/reveal-tckn")).toEqual([
      "owner",
      "operator",
      "finance",
    ])
    for (const path of ["", "/pkg_1", "/pkg_1/price", "/pkg_1/archive", "/pkg_1/restore"]) {
      expect(allowedRoles("POST", `/admin/cp/plans${path}`)).toEqual(["owner", "finance"])
    }
  })

  it("records every read of a shop and the TCKN before it is shown (C7)", () => {
    expect(matchRoute("GET", "/admin/cp/tenants/ten_1")?.rule.auditBefore).toBe(true)
    const reveal = matchRoute("POST", "/admin/cp/tenants/ten_1/reveal-tckn")?.rule

    expect(reveal?.auditBefore).toBe(true)
    expect(CP_ROUTES.filter((rule) => rule.auditBefore).map((rule) => rule.path)).toEqual([
      "/admin/cp/tenants/:id",
      "/admin/cp/tenants/:id/reveal-tckn",
    ])
    // Every shop route records against the shop it names, so its activity reads it
    for (const rule of CP_ROUTES.filter((each) => each.path.startsWith("/admin/cp/tenants/"))) {
      expect(rule.resource).toEqual({ type: "tenant", param: "id" })
    }
  })

  it("gives the keys to the owner alone, every change behind a step-up (C8)", () => {
    const keys = CP_ROUTES.filter((rule) => rule.path.startsWith("/admin/cp/keys"))

    expect(keys.map((rule) => `${rule.method} ${rule.path}`).sort()).toEqual([
      "GET /admin/cp/keys",
      "POST /admin/cp/keys/rewrap",
      "POST /admin/cp/keys/signing/prepare",
      "POST /admin/cp/keys/signing/retire",
      "POST /admin/cp/keys/signing/switch",
    ])
    for (const rule of keys) {
      expect(CP_STAFF_ROLES.filter((role) => decide(rule, staff(role)).allowed)).toEqual(["owner"])
      expect(rule.stepUp === true).toBe(rule.method === "POST")
    }
  })

  it("gives a shop's setup to the owner and operator, every start behind a step-up (C10)", () => {
    const setup = CP_ROUTES.filter((rule) => rule.path.includes("/provisioning"))

    expect(setup.map((rule) => `${rule.method} ${rule.path}`).sort()).toEqual([
      "GET /admin/cp/tenants/:id/provisioning",
      "GET /admin/cp/tenants/:id/provisioning/runs/:run_id",
      "POST /admin/cp/tenants/:id/provisioning",
      "POST /admin/cp/tenants/:id/provisioning/apply-pack",
      "POST /admin/cp/tenants/:id/provisioning/invite",
      "POST /admin/cp/tenants/:id/provisioning/start",
      "POST /admin/cp/tenants/:id/provisioning/stop",
    ])
    for (const rule of setup) {
      expect(CP_STAFF_ROLES.filter((role) => decide(rule, staff(role)).allowed)).toEqual([
        "owner",
        "operator",
      ])
      expect(rule.stepUp === true).toBe(rule.method === "POST")
      expect(rule.resource).toEqual({ type: "tenant", param: "id" })
    }
  })

  it("lets every role manage its own account once 2FA is passed", () => {
    const own = CP_ROUTES.filter(
      (rule) => rule.path.startsWith("/admin/cp/me") && rule.access !== "setup"
    )
    for (const rule of own) {
      for (const role of CP_STAFF_ROLES) {
        expect(decide(rule, staff(role)).allowed).toBe(true)
      }
    }
  })

  it("keeps a pending member to the setup, whatever their role (Ek C4, M3)", () => {
    for (const rule of CP_ROUTES.filter((each) => each.access !== "public")) {
      const decision = decide(rule, { role: "owner", mfaPassed: true, pending: true })

      expect(decision.allowed).toBe(rule.access === "setup")
    }
  })

  it("lets a fresh sign-in stand in for the step-up on ending other sessions only (M2)", () => {
    const fresh = CP_ROUTES.filter((rule) => rule.freshSignIn).map(
      (rule) => `${rule.method} ${rule.path}`
    )

    expect(fresh).toEqual(["POST /admin/cp/me/sessions/revoke-others"])
    expect(CP_ROUTES.filter((rule) => rule.freshSignIn && !rule.stepUp)).toHaveLength(0)
  })

  it("gives a suspension and its end to the owner and operator, behind a step-up (C15)", () => {
    for (const action of ["suspend", "resume"]) {
      const path = `/admin/cp/tenants/ten_1/${action}`
      expect(allowedRoles("POST", path)).toEqual(["owner", "operator"])
      expect(matchRoute("POST", path)?.rule).toMatchObject({
        stepUp: true,
        resource: { type: "tenant", param: "id" },
      })
    }
  })

  it("gives billing's reads to all, its money to finance and the owner, behind a step-up (C16)", () => {
    expect(allowedRoles("GET", "/admin/cp/payments")).toEqual([...CP_STAFF_ROLES])
    expect(allowedRoles("GET", "/admin/cp/tenants/ten_1/subscription")).toEqual([...CP_STAFF_ROLES])
    expect(allowedRoles("GET", "/admin/cp/billing-settings")).toEqual([...CP_STAFF_ROLES])
    for (const path of [
      "/admin/cp/tenants/ten_1/subscription",
      "/admin/cp/tenants/ten_1/charges/chg_1/pay",
      "/admin/cp/tenants/ten_1/charges/chg_1/waive",
      "/admin/cp/tenants/ten_1/charges/chg_1/amount",
    ]) {
      expect(allowedRoles("POST", path)).toEqual(["owner", "finance"])
      expect(matchRoute("POST", path)?.rule).toMatchObject({
        stepUp: true,
        resource: { type: "tenant", param: "id" },
      })
    }
    // Voiding says nothing was owed; the instruction is an account every shop pays to
    expect(allowedRoles("POST", "/admin/cp/tenants/ten_1/charges/chg_1/void")).toEqual(["owner"])
    expect(allowedRoles("POST", "/admin/cp/billing-settings")).toEqual(["owner"])
    expect(matchRoute("POST", "/admin/cp/billing-settings")?.rule.stepUp).toBe(true)
  })
})
