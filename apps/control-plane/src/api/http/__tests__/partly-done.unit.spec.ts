import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { aiProviderOfKeyName } from "../../../lib/vault/secret-names"
import { DELETE } from "../../admin/cp/ai/providers/[service]/route"
import { POST } from "../../admin/cp/ai/settings/route"

/**
 * #384 review (low): a key's delete or a settings save that fails after
 * it has changed something still says on its audit row what it changed,
 * marked `unfinished` (the step, the failure's class and code, never its
 * message), and the answer is still the error. The happy path's row is as
 * before. The routing and the vault are in memory here.
 */

interface Route {
  service: string
  model: string
}

const state = {
  routing: {} as Record<string, Route>,
  held: new Set<string>(),
  /** Throws on the n-th call to the routing's unroute (1-based), when set. */
  unrouteFailsAt: 0,
  /** Throws on the n-th read of the held keys (1-based), when set. */
  keysFailAt: 0,
}
let unroutes = 0
let keyReads = 0

/** A driver's failure: its message quotes what it was given, its code is loggable. */
const driverFailure = () =>
  Object.assign(new Error("terminating connection: sk-should-never-be-audited"), {
    name: "DriverException",
    code: "57P01",
  })

const snapshot = () => ({
  dailyCap: 300,
  lifetimeMonths: 12,
  packs: [],
  routing: { ...state.routing },
})

jest.mock("../../../lib/ai-credits/platform-settings", () => ({
  aiCreditSettingsOf: jest.fn(() => Promise.resolve(snapshot())),
  saveAiCreditSettings: jest.fn(
    (_container: unknown, change: { routing?: Record<string, Route> }) => {
      const before = snapshot()
      state.routing = { ...change.routing }
      return Promise.resolve({ before, after: snapshot() })
    }
  ),
  unrouteService: jest.fn((_container: unknown, service: string) => {
    unroutes += 1
    if (unroutes === state.unrouteFailsAt) {
      return Promise.reject(driverFailure())
    }
    const entries = Object.entries(state.routing)
    state.routing = Object.fromEntries(entries.filter(([, route]) => route.service !== service))
    return Promise.resolve(entries.filter(([, route]) => route.service === service).map(([c]) => c))
  }),
}))

const vault = {
  listSecretRecords: jest.fn((filter: { name: string[] }) => {
    keyReads += 1
    if (keyReads === state.keysFailAt) {
      return Promise.reject(driverFailure())
    }
    return Promise.resolve(
      filter.name
        .filter((name) => state.held.has(aiProviderOfKeyName(name) ?? ""))
        .map((name) => ({ name, version: 1, created_at: new Date("2026-11-25T00:00:00Z") }))
    )
  }),
  retireSecret: jest.fn((_owner: string, name: string) =>
    Promise.resolve(state.held.delete(aiProviderOfKeyName(name) ?? ""))
  ),
}

function request(path: string, extra: Record<string, unknown> = {}) {
  const req = {
    scope: { resolve: jest.fn(() => vault) },
    params: { service: "deepseek" },
    originalUrl: path,
    auth_context: { actor_id: "user_owner" },
    ...extra,
  }
  const res = { json: jest.fn(), setHeader: jest.fn(), status: jest.fn() }
  res.status.mockReturnValue(res)
  return {
    req: req as unknown as AuthenticatedMedusaRequest<never>,
    res: res as unknown as MedusaResponse,
    json: res.json,
    /** What the handler noted for its audit row (`noteAuditChanges`). */
    audit: () => (req as unknown as { cpAuditChanges?: unknown }).cpAuditChanges,
  }
}

const caught = (run: () => Promise<unknown>) =>
  run().then(
    () => null,
    (error: unknown) => error
  )

beforeEach(() => {
  state.routing = { text: { service: "deepseek", model: "deepseek-flash" } }
  state.held = new Set(["deepseek", "fake"])
  state.unrouteFailsAt = 0
  state.keysFailAt = 0
  unroutes = 0
  keyReads = 0
  jest.clearAllMocks()
})

describe("a key's delete stopped partway", () => {
  const remove = () => request("/admin/cp/ai/providers/deepseek")

  it("audits the delete as before when every step runs", async () => {
    const call = remove()
    await DELETE(call.req, call.res)

    expect(call.audit()).toEqual({ key: { deleted: true }, unrouted: ["text"] })
    expect(call.json).toHaveBeenCalledWith({
      provider: { service: "deepseek", has_key: false },
      deleted: true,
      unrouted: ["text"],
    })
  })

  it("audits the retired key when the last unroute fails, and answers the error", async () => {
    state.unrouteFailsAt = 2
    const call = remove()
    const error = await caught(() => DELETE(call.req, call.res))

    expect(error).toMatchObject({ name: "DriverException", code: "57P01" })
    expect(state.held.has("deepseek")).toBe(false)
    expect(call.audit()).toEqual({
      key: { deleted: true },
      unrouted: ["text"],
      unfinished: { step: "unroute_again", name: "DriverException", code: "57P01" },
    })
    expect(JSON.stringify(call.audit())).not.toContain("sk-should-never")
    expect(call.json).not.toHaveBeenCalled()
  })

  it("notes nothing when the first unroute fails: nothing has changed", async () => {
    state.unrouteFailsAt = 1
    const call = remove()
    const error = await caught(() => DELETE(call.req, call.res))

    expect(error).toMatchObject({ code: "57P01" })
    expect(state.held.has("deepseek")).toBe(true)
    expect(call.audit()).toBeUndefined()
  })
})

describe("a settings save stopped partway", () => {
  const save = (routing: Record<string, Route>) =>
    request("/admin/cp/ai/settings", { validatedBody: { routing } })
  const fakeText = { text: { service: "fake", model: "fake-text" } }

  it("audits the change as before when every step runs", async () => {
    const call = save(fakeText)
    await POST(call.req, call.res)

    expect(call.audit()).toEqual({
      routing: { from: { text: { service: "deepseek", model: "deepseek-flash" } }, to: fakeText },
    })
    expect(call.json).toHaveBeenCalledTimes(1)
  })

  it("audits the saved change when the keys' second read fails, and answers the error", async () => {
    state.keysFailAt = 2
    const call = save(fakeText)
    const error = await caught(() => POST(call.req, call.res))

    expect(error).toMatchObject({ name: "DriverException", code: "57P01" })
    expect(state.routing).toEqual(fakeText)
    expect(call.audit()).toEqual({
      routing: { from: { text: { service: "deepseek", model: "deepseek-flash" } }, to: fakeText },
      unfinished: { step: "recheck_keys", name: "DriverException", code: "57P01" },
    })
    expect(JSON.stringify(call.audit())).not.toContain("sk-should-never")
    expect(call.json).not.toHaveBeenCalled()
  })

  it("notes nothing when the first read of the keys fails: nothing is saved", async () => {
    state.keysFailAt = 1
    const call = save(fakeText)
    const error = await caught(() => POST(call.req, call.res))

    expect(error).toMatchObject({ code: "57P01" })
    expect(call.audit()).toBeUndefined()
  })
})
