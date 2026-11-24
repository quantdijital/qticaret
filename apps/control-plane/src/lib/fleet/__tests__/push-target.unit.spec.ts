import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { CP_ROUTES } from "../../staff/route-table"
import { PUSH_MAX_ATTEMPTS, nextPushAt } from "../push"
import {
  parseTenantApiHosts,
  pushPolicy,
  pushTargetProblem,
  pushUrl,
  tenantApiUrlProblem,
} from "../push-target"
import { TENANT_API_ROUTES, matchTenantApi } from "../tenant-api-routes"

const deployed = {
  local: false,
  hosts: parseTenantApiHosts("tenant-mylarte, .tenants.internal, shop.local:9100"),
}
const local = { local: true, hosts: [] }

describe("the push target policy (Ek C9, review L4)", () => {
  it.each([
    ["http://tenant-mylarte:9000", deployed],
    ["http://tenant-mylarte", deployed],
    ["https://a.tenants.internal", deployed],
    ["http://shop.local:9100", deployed],
    ["http://localhost:9000/", local],
    ["http://127.0.0.1:9200", local],
    ["http://mylarte.localhost:9299", local],
  ])("allows %s", (url, policy) => {
    expect(pushTargetProblem(url, policy)).toBeNull()
  })

  it.each([
    ["http://localhost:9000", deployed, "target_not_allowed"],
    ["http://tenants.internal", deployed, "target_not_allowed"],
    ["http://evil.example", deployed, "target_not_allowed"],
    ["http://10.0.0.5:9000", deployed, "target_not_allowed"],
    // Only the expected ports: 9000, 80, 443, or the entry's own
    ["http://tenant-mylarte:5432", deployed, "target_not_allowed"],
    ["http://shop.local:9000", deployed, "target_not_allowed"],
    ["http://localhost:6379", local, "target_not_allowed"],
    ["http://localhost:80", local, "target_not_allowed"],
    ["http://user:pw@tenant-mylarte", deployed, "target_invalid"],
    ["http://tenant-mylarte/api", deployed, "target_invalid"],
    ["http://tenant-mylarte/?x=1", deployed, "target_invalid"],
    ["ftp://tenant-mylarte", deployed, "target_invalid"],
    ["not a url", deployed, "target_invalid"],
  ])("refuses %s", (url, policy, code) => {
    expect(pushTargetProblem(url, policy)).toBe(code)
  })

  it("reads CP_TENANT_API_HOSTS: internal names and namespaces only, ports optional", () => {
    expect(parseTenantApiHosts(" Tenant-A , .tenants.internal ,shop.local:9100")).toEqual([
      { host: "tenant-a", port: null },
      { host: ".tenants.internal", port: null },
      { host: "shop.local", port: 9100 },
    ])
    expect(parseTenantApiHosts(undefined)).toEqual([])
    for (const bad of [
      "http://x",
      ".example.com",
      "shop.example.com",
      "10.0.0.5",
      "a:99999",
      ".com",
    ]) {
      expect(() => parseTenantApiHosts(bad)).toThrow("CP_TENANT_API_HOSTS")
    }
    expect(pushPolicy({ NODE_ENV: "production" }).local).toBe(false)
    expect(pushPolicy({ NODE_ENV: "test" }).local).toBe(true)
    expect(pushPolicy({}).local).toBe(false)
  })

  it("is the check the provisioner reuses, from the environment", () => {
    const env = { NODE_ENV: "production", CP_TENANT_API_HOSTS: "tenant-mylarte" }
    expect(tenantApiUrlProblem("http://tenant-mylarte:9000", env)).toBeNull()
    expect(tenantApiUrlProblem("http://localhost:9000", env)).toBe("target_not_allowed")
  })

  it("pushes to the shop's hook under its base URL", () => {
    expect(pushUrl("http://tenant-mylarte:9000/")).toBe(
      "http://tenant-mylarte:9000/hooks/control-plane/plan"
    )
  })

  it("backs off 1, 2, 4… minutes up to an hour, then gives up", () => {
    const now = new Date(0)
    expect(nextPushAt(1, now)?.getTime()).toBe(60_000)
    expect(nextPushAt(3, now)?.getTime()).toBe(4 * 60_000)
    expect(nextPushAt(PUSH_MAX_ATTEMPTS - 1, now)?.getTime()).toBe(60 * 60_000)
    expect(nextPushAt(PUSH_MAX_ATTEMPTS, now)).toBeNull()
  })
})

const API_ROOT = join(__dirname, "../../../api")

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return routeFiles(path)
    }
    return name === "route.ts" ? [path] : []
  })
}

describe("the tenant API's route table (adr/0061 §3.4, Ek C9)", () => {
  const handlers = routeFiles(join(API_ROOT, "tenant-api")).flatMap((file) => {
    const path = `/${relative(API_ROOT, file).split(sep).slice(0, -1).join("/")}`
    return [...readFileSync(file, "utf8").matchAll(/export (?:async )?function (GET|POST)\b/g)].map(
      ([, method]) => `${method ?? ""} ${path}`
    )
  })

  it("lists every route file's handler, and no route without one", () => {
    expect(handlers.sort()).toEqual(
      TENANT_API_ROUTES.map((rule) => `${rule.method} ${rule.path}`).sort()
    )
  })

  it("is apart from the staff's table, and answers nothing it does not list", () => {
    expect(CP_ROUTES.some((rule) => rule.path.includes("tenant-api"))).toBe(false)
    expect(matchTenantApi("GET", "/tenant-api/v1/plan")?.maxBodyBytes).toBe(0)
    expect(matchTenantApi("HEAD", "/tenant-api/v1/plan")).not.toBeNull()
    expect(matchTenantApi("POST", "/tenant-api/v1/plan")).toBeNull()
    expect(matchTenantApi("GET", "/tenant-api/v1/usage")).toBeNull()
    // Ek C20: the payment history is read only, and takes no body
    expect(matchTenantApi("GET", "/tenant-api/v1/billing")?.maxBodyBytes).toBe(0)
    expect(matchTenantApi("POST", "/tenant-api/v1/billing")).toBeNull()
  })
})
