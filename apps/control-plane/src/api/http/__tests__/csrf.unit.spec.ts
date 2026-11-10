import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SESSION_COOKIE } from "../../../lib/session-cookie"
import { csrfProtection } from "../csrf"

jest.mock("../../../lib/env", () => ({
  parseEnv: () => ({ ADMIN_CORS: "http://localhost:5174", AUTH_CORS: "http://localhost:5174" }),
}))

const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() }

function request(headers: Record<string, string>, url = "/admin/cp/me") {
  return {
    originalUrl: url,
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "2", ...headers },
    requestId: undefined,
    scope: { resolve: () => logger },
  } as unknown as MedusaRequest
}

function run(req: MedusaRequest) {
  const state: { status?: number } = {}
  const res = {
    headersSent: false,
    setHeader: jest.fn(),
    removeHeader: jest.fn(),
    status(code: number) {
      state.status = code
      return res
    },
    json: () => res,
  }
  const next = jest.fn()
  csrfProtection(req, res as unknown as MedusaResponse, next)
  return { state, next }
}

describe("csrfProtection and the staff session cookie (Ek C6)", () => {
  it("names the control plane's own cookie, not Medusa's default", () => {
    expect(SESSION_COOKIE).not.toBe("connect.sid")
  })

  it("refuses a cookie mutation from another origin", () => {
    const result = run(
      request({ cookie: `${SESSION_COOKIE}=s%3Aabc`, origin: "https://evil.test" })
    )

    expect(result.next).not.toHaveBeenCalled()
    expect(result.state.status).toBe(403)
  })

  it("takes a cookie mutation from the panel's origin", () => {
    const result = run(
      request({ cookie: `${SESSION_COOKIE}=s%3Aabc`, origin: "http://localhost:5174" })
    )

    expect(result.next).toHaveBeenCalled()
  })

  it("leaves a request with only another app's cookie alone: no session of ours rides on it", () => {
    const result = run(request({ cookie: "connect.sid=s%3Aabc", origin: "https://evil.test" }))

    expect(result.next).toHaveBeenCalled()
  })
})
