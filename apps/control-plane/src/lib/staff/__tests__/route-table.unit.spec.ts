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
      expect(decide(matchRoute("GET", "/admin/cp/tenants")?.rule ?? null, staff(role))).toEqual({
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
      "POST /admin/cp/me/mfa/recovery-codes",
      "POST /admin/cp/me/sessions/revoke-others",
      "POST /admin/cp/staff/invites",
      "POST /admin/cp/staff/members/:id",
      "POST /admin/cp/staff/members/:id/deactivate",
      "POST /admin/cp/staff/members/:id/reactivate",
      "POST /admin/cp/staff/members/:id/reset-mfa",
    ])
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
})
