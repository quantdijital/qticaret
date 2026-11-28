import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { SupportSession } from "../../../lib/support-access/store"

const get = jest.fn<Promise<SupportSession | null>, [string]>()
const end = jest.fn().mockResolvedValue({ result: null })
const rejected = jest.fn()
let enabled = true

jest.mock("../../../lib/support-access/store", () => ({ supportStore: () => ({ get }) }))
jest.mock("../../../workflows/support-access", () => ({
  endSupportSessionWorkflow: () => ({ run: end }),
}))
jest.mock("../audit/context", () => ({
  auditContext: () => ({ request_id: "req_1", ip: "127.0.0.1", user_agent: "jest" }),
}))
jest.mock("../reject", () => ({
  rejectRequest: (_req: unknown, _res: unknown, status: number, body: { message: string }) => {
    rejected(status, body.message)
  },
}))

import { guardSupportAuth, guardSupportRequest, openSupportSessionOf } from "../support-guard"

/** adr/0061 Ek "Destek erişimi", Karar 4–5: a support session held to its record and its list. */

const ACTOR = "qtsup_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX"
const GRANT = "sgr_AAECAwQFBgcICQoLDA0ODxAREhMUFRYX"

const record = (over: Partial<SupportSession> = {}): SupportSession => ({
  grant_id: GRANT,
  actor_id: ACTOR,
  operator: { id: "user_1", name: "Ayşe", role: "operator" },
  reason: "Ürün girişine yardım",
  started_at: new Date(Date.now() - 60_000).toISOString(),
  expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  ...over,
})

const destroy = jest.fn()

const requestOf = (method: string, url: string, actorId = ACTOR, body: unknown = {}) =>
  ({
    method,
    url,
    originalUrl: url,
    path: url,
    headers: {},
    body,
    auth_context: { actor_type: "user", actor_id: actorId },
    session: { auth_context: { actor_type: "user", actor_id: actorId }, destroy },
    scope: {
      resolve: () => ({
        getSection: () => Promise.resolve({ support_access_enabled: enabled }),
      }),
    },
  }) as unknown as MedusaRequest

const run = async (req: MedusaRequest) => {
  const next = jest.fn()
  const handled = await guardSupportRequest(req, {} as MedusaResponse, next)
  return { handled, next }
}

describe("guardSupportRequest", () => {
  beforeEach(() => {
    get.mockReset()
    end.mockClear()
    rejected.mockClear()
    destroy.mockClear()
    enabled = true
  })

  it("leaves a team member's request to the role layer", async () => {
    const { handled } = await run(requestOf("GET", "/admin/products", "user_1"))
    expect(handled).toBe(false)
    expect(get).not.toHaveBeenCalled()
  })

  it("passes an open session's allowed request, noting the session for the routes", async () => {
    get.mockResolvedValue(record())
    const req = requestOf("POST", "/admin/products")
    const { handled, next } = await run(req)
    expect([handled, next.mock.calls.length]).toEqual([true, 1])
    expect(openSupportSessionOf(req)?.grant_id).toBe(GRANT)
  })

  it("refuses the sensitive list with 403, the session kept", async () => {
    get.mockResolvedValue(record())
    for (const [method, url, body] of [
      ["POST", "/admin/staff/invites", {}],
      ["POST", "/admin/integrations/credentials/paytr", {}],
      ["POST", "/admin/async-jobs", { type: "customer.export" }],
    ] as const) {
      const { next } = await run(requestOf(method, url, ACTOR, body))
      expect(next).not.toHaveBeenCalled()
    }
    expect(rejected.mock.calls).toEqual([
      [403, "support.forbidden"],
      [403, "support.forbidden"],
      [403, "support.forbidden"],
    ])
    expect(destroy).not.toHaveBeenCalled()
  })

  it.each([
    ["gone from the store", null],
    ["ended by the owner", record({ ended_reason: "ended_by_owner" })],
    ["past its time", record({ expires_at: new Date(Date.now() - 1).toISOString() })],
    ["of another actor", record({ actor_id: "qtsup_other" })],
  ])("ends a session %s: 401 and the browser's session destroyed", async (_name, stored) => {
    get.mockResolvedValue(stored)
    const { next } = await run(requestOf("GET", "/admin/products"))
    expect(next).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledWith(401, "support.session_ended")
    expect(destroy).toHaveBeenCalled()
  })

  it("ends every session once the owner's switch is off, and records why", async () => {
    get.mockResolvedValue(record())
    enabled = false
    const { next } = await run(requestOf("GET", "/admin/products"))
    expect(next).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledWith(401, "support.session_ended")
    expect(end).toHaveBeenCalledWith({
      input: expect.objectContaining({ grant_id: GRANT, reason: "disabled" }) as unknown,
    })
  })

  it("fails closed when the store cannot be read", async () => {
    get.mockRejectedValue(new Error("redis down"))
    const { next } = await run(requestOf("GET", "/admin/products"))
    expect(next).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledWith(503, "support.unavailable")
  })
})

describe("guardSupportAuth", () => {
  beforeEach(() => {
    get.mockReset()
    end.mockClear()
    rejected.mockClear()
  })

  it("lets a support session sign out, its record ended first", async () => {
    const next = jest.fn()
    await guardSupportAuth(requestOf("DELETE", "/auth/session"), {} as MedusaResponse, next)
    expect(end).toHaveBeenCalledWith({
      input: expect.objectContaining({ reason: "logout" }) as unknown,
    })
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("refuses a token minted from a support session", async () => {
    get.mockResolvedValue(record())
    const next = jest.fn()
    await guardSupportAuth(requestOf("POST", "/auth/token/refresh"), {} as MedusaResponse, next)
    expect(next).not.toHaveBeenCalled()
    expect(rejected).toHaveBeenCalledWith(403, "support.forbidden")
  })
})
