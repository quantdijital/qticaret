import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createMemoryStore } from "@qticaret/server-kit"
import { CP_RATE_LIMIT_PROFILES } from "../../../lib/rate-limit-profiles"
import { rejectAmbiguousPath, requestBasics, routeAllowlist } from "../guards"
import { authIdentity, authProfile, rateLimit } from "../rate-limit"

const logs: string[] = []
const logger = { info: (line: string) => logs.push(line), error: jest.fn(), warn: jest.fn() }

function request(url: string, fields: { method?: string; body?: unknown; ip?: string } = {}) {
  return {
    originalUrl: url,
    method: fields.method ?? "GET",
    body: fields.body,
    ip: fields.ip ?? "203.0.113.7",
    socket: {},
    headers: {},
    requestId: undefined,
    scope: { resolve: () => logger },
  } as unknown as MedusaRequest
}

function response() {
  const headers = new Map<string, string>()
  const state: { status?: number; body?: unknown } = {}
  const res = {
    headersSent: false,
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    removeHeader: (name: string) => headers.delete(name.toLowerCase()),
    status(code: number) {
      state.status = code
      return res
    },
    json(body: unknown) {
      state.body = body
      return res
    },
  }
  return { res: res as unknown as MedusaResponse, headers, state }
}

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: () => void) => unknown

async function run(middleware: Middleware, req: MedusaRequest) {
  const out = response()
  const next = jest.fn()
  await middleware(req, out.res, next)
  return { ...out, next }
}

beforeEach(() => {
  logs.length = 0
})

describe("routeAllowlist", () => {
  it("answers a core route with 404, the reason logged, no route named in the body", async () => {
    const result = await run(routeAllowlist, request("/admin/products?limit=1"))

    expect(result.next).not.toHaveBeenCalled()
    expect(result.state.status).toBe(404)
    expect(result.state.body).toMatchObject({ type: "not_found", message: "errors.not_found" })
    expect(result.headers.get("x-content-type-options")).toBe("nosniff")
    expect(logs.join("\n")).toContain('"reason":"not_allowed"')
    expect(logs.join("\n")).not.toContain("limit=1")
  })

  it("lets the control plane's own routes through", async () => {
    for (const url of ["/health", "/admin/cp/tenants", "/auth/user/emailpass", "/tenant-api/v1"]) {
      expect((await run(routeAllowlist, request(url))).next).toHaveBeenCalled()
    }
  })
})

describe("rejectAmbiguousPath", () => {
  it("refuses a dot segment before the allowlist could read past it", async () => {
    const result = await run(rejectAmbiguousPath, request("/admin/cp/../products"))

    expect(result.state.status).toBe(400)
    expect(result.next).not.toHaveBeenCalled()
  })
})

describe("requestBasics", () => {
  it("replaces a forged request ID and sets the security headers", async () => {
    const req = request("/health")
    ;(req as { requestId?: string }).requestId = "x\nINFO forged"
    const result = await run(requestBasics, req)

    expect(result.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.headers.get("content-security-policy")).toContain("default-src 'none'")
    expect(result.headers.get("x-frame-options")).toBe("DENY")
    expect(result.next).toHaveBeenCalled()
  })
})

describe("rateLimit", () => {
  it("counts a sign-in per address and e-mail, and answers 429 with Retry-After", async () => {
    const store = createMemoryStore()
    const limiter = rateLimit(authProfile, { identity: authIdentity, store: () => store })
    const login = () =>
      request("/auth/user/emailpass", { method: "POST", body: { email: "Staff@Quant.test" } })
    const max = CP_RATE_LIMIT_PROFILES.login.perIdentity.max

    for (let i = 0; i < max; i += 1) {
      expect((await run(limiter, login())).next).toHaveBeenCalled()
    }
    const refused = await run(limiter, login())

    expect(refused.state.status).toBe(429)
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(logs.join("\n")).toContain("rate_limit_cp_login")
    expect(logs.join("\n")).not.toContain("quant.test")
  })

  it("reads a reset's account from `identifier`", () => {
    const req = request("/auth/user/emailpass/reset-password", {
      method: "POST",
      body: { identifier: "a@b.test", email: "decoy@b.test" },
    })

    expect(authProfile(req)).toBe(CP_RATE_LIMIT_PROFILES.password_reset)
    expect(authIdentity(req)).toBe("a@b.test")
  })
})
