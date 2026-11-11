import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { CP_ROUTES } from "../../staff/route-table"
import { PUSH_MAX_ATTEMPTS, nextPushAt, pushPolicy } from "../push"
import { parseTenantApiHosts, pushTargetProblem, pushUrl } from "../push-target"
import { TENANT_API_ROUTES, matchTenantApi } from "../tenant-api-routes"

const deployed = { local: false, hosts: ["tenant-mylarte", ".tenants.internal"] }
const local = { local: true, hosts: [] }

describe("the push target policy (Ek C9)", () => {
  it.each([
    ["http://tenant-mylarte:9000", deployed],
    ["https://a.tenants.internal", deployed],
    ["http://localhost:9000/", local],
    ["http://127.0.0.1:9200", local],
    ["http://mylarte.localhost:9000", local],
  ])("allows %s", (url, policy) => {
    expect(pushTargetProblem(url, policy)).toBeNull()
  })

  it.each([
    ["http://localhost:9000", deployed, "target_not_allowed"],
    ["http://tenants.internal", deployed, "target_not_allowed"],
    ["http://evil.example", deployed, "target_not_allowed"],
    ["http://10.0.0.5:9000", deployed, "target_not_allowed"],
    ["http://user:pw@tenant-mylarte", deployed, "target_invalid"],
    ["http://tenant-mylarte/api", deployed, "target_invalid"],
    ["http://tenant-mylarte/?x=1", deployed, "target_invalid"],
    ["ftp://tenant-mylarte", deployed, "target_invalid"],
    ["not a url", deployed, "target_invalid"],
  ])("refuses %s", (url, policy, code) => {
    expect(pushTargetProblem(url, policy)).toBe(code)
  })

  it("reads CP_TENANT_API_HOSTS, refusing anything but names and suffixes", () => {
    expect(parseTenantApiHosts(" Tenant-A , .tenants.internal ,")).toEqual([
      "tenant-a",
      ".tenants.internal",
    ])
    expect(parseTenantApiHosts(undefined)).toEqual([])
    expect(() => parseTenantApiHosts("http://x")).toThrow("CP_TENANT_API_HOSTS")
    expect(pushPolicy({ NODE_ENV: "production" }).local).toBe(false)
    expect(pushPolicy({ NODE_ENV: "test" }).local).toBe(true)
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
  })
})
