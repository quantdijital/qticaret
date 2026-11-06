import type { MedusaRequest } from "@medusajs/framework/http"
import { endOtherSessions, openSessionCount, sessionIdsOf } from "../staff-sessions"

interface Session {
  id?: string
  auth_context?: { actor_type: string; actor_id: string }
}

const staff = (id: string, user: string): Session => ({
  id,
  auth_context: { actor_type: "user", actor_id: user },
})

/** A request whose session store lists as connect-redis does (an array) or memory does (a map). */
function requestWith(sessions: Session[], shape: "array" | "map", current = "s1") {
  const destroyed: string[] = []
  const store = {
    all: (callback: (error: unknown, listed?: unknown) => void) => {
      callback(
        null,
        shape === "array"
          ? sessions
          : Object.fromEntries(sessions.map(({ id, ...rest }) => [id ?? "", rest]))
      )
    },
    destroy: (sid: string, callback: (error?: unknown) => void) => {
      destroyed.push(sid)
      callback()
    },
  }
  const req = { sessionStore: store, sessionID: current } as unknown as MedusaRequest
  return { req, destroyed }
}

const SESSIONS = [
  staff("s1", "user_1"),
  staff("s2", "user_1"),
  staff("s3", "user_2"),
  { id: "s4", auth_context: { actor_type: "customer", actor_id: "user_1" } },
  { id: "s5" },
]

describe.each(["array", "map"] as const)("a staff member's sessions (%s store)", (shape) => {
  it("counts their own sessions only", async () => {
    const { req } = requestWith(SESSIONS, shape)
    await expect(sessionIdsOf(req, "user_1")).resolves.toEqual(["s1", "s2"])
    await expect(openSessionCount(req, "user_2")).resolves.toBe(1)
  })

  it("ends their other sessions and keeps the one asking", async () => {
    const { req, destroyed } = requestWith(SESSIONS, shape)
    await expect(endOtherSessions(req, "user_1")).resolves.toBe(1)
    expect(destroyed).toEqual(["s2"])
  })

  it("ends them all for a request that has no session of its own (a bearer token)", async () => {
    const { req, destroyed } = requestWith(SESSIONS, shape, "fresh")
    await expect(endOtherSessions(req, "user_1")).resolves.toBe(2)
    expect(destroyed).toEqual(["s1", "s2"])
  })
})

describe("a store that cannot list", () => {
  it("says it does not know, and ends nothing", async () => {
    const req = { sessionStore: { destroy: jest.fn() } } as unknown as MedusaRequest
    await expect(openSessionCount(req, "user_1")).resolves.toBeNull()
    await expect(endOtherSessions(req, "user_1")).resolves.toBe(0)
  })

  it("logs a failing store and answers unknown", async () => {
    const req = {
      sessionStore: {
        all: (callback: (error: unknown) => void) => {
          callback(new Error("redis down"))
        },
        destroy: jest.fn(),
      },
    } as unknown as MedusaRequest
    await expect(sessionIdsOf(req, "user_1")).resolves.toBeNull()
  })
})
