import type { MedusaRequest } from "@medusajs/framework/http"
import { newBirfaturaToken } from "../../../lib/invoicing/birfatura"
import { logger } from "../../../lib/logging"
import { createMemoryStore } from "../../../lib/security/rate-limit"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { birfaturaGuard } from "../birfatura-guard"
import { fakeResponse } from "./fakes"

// The address limits count by: no environment to read in a unit test
jest.mock("../client-ip", () => ({ clientIp: () => "203.0.113.7" }))
jest.mock("../security-headers", () => ({ applySecurityHeaders: () => undefined }))

const TOKEN = newBirfaturaToken()

function request(
  options: { provider?: string; stored?: string | null; header?: string; query?: unknown } = {}
) {
  const read = jest.fn(() =>
    Promise.resolve(
      options.stored === null ? null : { settings: {}, secrets: { token: options.stored ?? TOKEN } }
    )
  )
  const services: Record<string, unknown> = {
    [PLATFORM_SETTINGS_MODULE]: {
      readSection: () => Promise.resolve({ values: { provider: options.provider ?? "birfatura" } }),
    },
    [INTEGRATION_CREDENTIALS_MODULE]: { read },
  }
  const req = {
    path: "/hooks/birfatura/api/orders",
    originalUrl: "/hooks/birfatura/api/orders",
    method: "POST",
    headers: options.header === undefined ? {} : { token: options.header },
    query: options.query ?? {},
    socket: {},
    requestId: "req-12345678",
    scope: { resolve: (name: string) => services[name] },
  } as unknown as MedusaRequest
  return { req, read }
}

async function run(guard: ReturnType<typeof birfaturaGuard>, req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn()
  await guard(req, response.res, next)
  return { ...response, next }
}

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("BirFatura's door (adr/0072 §3)", () => {
  const guardWith = () => {
    const store = createMemoryStore()
    return { store, guard: birfaturaGuard({ store: () => store, scale: 1 }) }
  }

  it("lets the stored token through", async () => {
    const { guard } = guardWith()

    const result = await run(guard, request({ header: TOKEN }).req)

    expect(result.next).toHaveBeenCalledWith()
  })

  it("is 404 while BirFatura is not the shop's program, without reading the token", async () => {
    const { guard } = guardWith()
    const { req, read } = request({ provider: "external", header: TOKEN })

    const result = await run(guard, req)

    expect(result.status()).toBe(404)
    expect(result.next).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it("is 404 while no token was made", async () => {
    const { guard } = guardWith()

    const result = await run(guard, request({ stored: null, header: TOKEN }).req)

    expect(result.status()).toBe(404)
  })

  it.each([
    ["a wrong token", newBirfaturaToken()],
    ["no token", undefined],
    ["an empty one", ""],
  ])("answers %s 401 with no body", async (_name, header) => {
    const { guard } = guardWith()

    const result = await run(guard, request({ ...(header === undefined ? {} : { header }) }).req)

    expect(result.status()).toBe(401)
    expect(result.body()).toBeUndefined()
    expect(result.next).not.toHaveBeenCalled()
  })

  it("never takes the token from the query string", async () => {
    const { guard } = guardWith()

    const result = await run(guard, request({ query: { token: TOKEN } }).req)

    expect(result.status()).toBe(401)
  })

  it("refuses an address past ten wrong tokens a minute, even with the right one", async () => {
    const { guard } = guardWith()
    for (let i = 0; i < 10; i += 1) {
      await run(guard, request({ header: newBirfaturaToken() }).req)
    }

    const result = await run(guard, request({ header: TOKEN }).req)

    expect(result.status()).toBe(429)
    expect(result.headers["retry-after"]).toBe("60")
    expect(result.next).not.toHaveBeenCalled()
  })

  it("counts only wrong tokens: right ones never fill the budget", async () => {
    const { guard } = guardWith()
    for (let i = 0; i < 20; i += 1) {
      await run(guard, request({ header: TOKEN }).req)
    }

    const result = await run(guard, request({ header: TOKEN }).req)

    expect(result.next).toHaveBeenCalledWith()
  })

  it("never logs the token", async () => {
    const { guard } = guardWith()
    const info = jest.spyOn(logger, "info").mockImplementation(() => undefined)
    const wrong = newBirfaturaToken()

    await run(guard, request({ header: wrong }).req)

    expect(JSON.stringify(info.mock.calls)).not.toContain(wrong)
    expect(JSON.stringify(info.mock.calls)).not.toContain(TOKEN)
  })
})
