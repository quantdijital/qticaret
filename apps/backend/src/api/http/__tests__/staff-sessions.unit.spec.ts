import type { MedusaRequest } from "@medusajs/framework/http"
import { createMemoryAccountStore } from "../../../lib/staff/account-store"
import { endOtherSessions, openSessionCount, renewSession, sessionIdsOf } from "../staff-sessions"

interface Session {
  auth_context?: { actor_type: string; actor_id: string } | null
}

const staff = (user: string): Session => ({ auth_context: { actor_type: "user", actor_id: user } })

/** A request over a session store that answers by id, as express-session's stores do. */
function requestWith(sessions: Record<string, Session>, current = "s1") {
  const destroyed: string[] = []
  const all = jest.fn()
  const store = {
    all,
    get: (sid: string, callback: (error: unknown, session?: Session | null) => void) => {
      callback(null, sessions[sid] ?? null)
    },
    destroy: (sid: string, callback: (error?: unknown) => void) => {
      destroyed.push(sid)
      Reflect.deleteProperty(sessions, sid)
      callback()
    },
  }
  const req = { sessionStore: store, sessionID: current } as unknown as MedusaRequest
  return { req, destroyed, all }
}

async function noted(entries: [string, string][]) {
  const store = createMemoryAccountStore()
  for (const [user, sid] of entries) {
    await store.addSession(user, sid, 60_000)
  }
  return store
}

describe("a staff member's sessions", () => {
  it("reads only the member's noted sessions, never the whole store", async () => {
    const { req, all } = requestWith({
      s1: staff("user_1"),
      s2: staff("user_1"),
      s3: staff("user_2"),
    })
    const store = await noted([
      ["user_1", "s1"],
      ["user_1", "s2"],
      ["user_2", "s3"],
    ])

    await expect(sessionIdsOf(req, "user_1", store)).resolves.toEqual(["s1", "s2"])
    await expect(openSessionCount(req, "user_2", store)).resolves.toBe(1)
    expect(all).not.toHaveBeenCalled()
  })

  it("drops a noted session that ended elsewhere or now holds someone else", async () => {
    const { req } = requestWith({ s1: staff("user_1"), s4: staff("user_2") })
    const store = await noted([
      ["user_1", "s1"],
      ["user_1", "gone"],
      ["user_1", "s4"],
    ])

    await expect(sessionIdsOf(req, "user_1", store)).resolves.toEqual(["s1"])
    await expect(store.sessionIds("user_1")).resolves.toEqual(["s1"])
  })

  it("ends the member's other sessions and keeps the one asking", async () => {
    const { req, destroyed } = requestWith({ s1: staff("user_1"), s2: staff("user_1") })
    const store = await noted([
      ["user_1", "s1"],
      ["user_1", "s2"],
    ])

    await expect(endOtherSessions(req, "user_1", store)).resolves.toBe(1)
    expect(destroyed).toEqual(["s2"])
    await expect(store.sessionIds("user_1")).resolves.toEqual(["s1"])
  })

  it("ends them all for a request without a session of its own (a bearer token)", async () => {
    const { req, destroyed } = requestWith({ s1: staff("user_1"), s2: staff("user_1") }, "fresh")
    const store = await noted([
      ["user_1", "s1"],
      ["user_1", "s2"],
    ])
    await expect(endOtherSessions(req, "user_1", store)).resolves.toBe(2)
    expect(destroyed).toEqual(["s1", "s2"])
  })

  it("says it does not know when there is no session store", async () => {
    const req = {} as MedusaRequest
    await expect(openSessionCount(req, "user_1", createMemoryAccountStore())).resolves.toBeNull()
    await expect(endOtherSessions(req, "user_1", createMemoryAccountStore())).resolves.toBe(0)
  })
})

describe("a session renewed after a password change", () => {
  it("gets a new id, keeps who signed in, and moves the note", async () => {
    const store = await noted([["user_1", "old"]])
    const auth = { actor_type: "user", actor_id: "user_1" }
    const req = {
      sessionID: "old",
      session: {
        auth_context: auth,
        regenerate(callback: () => void) {
          Object.assign(req, {
            sessionID: "new",
            session: {
              auth_context: null,
              save: (done: () => void) => {
                done()
              },
            },
          })
          callback()
        },
      },
    }

    await renewSession(req as unknown as MedusaRequest, "user_1", store)

    expect(req.sessionID).toBe("new")
    expect(req.session.auth_context).toEqual(auth)
    await expect(store.sessionIds("user_1")).resolves.toEqual(["new"])
  })
})
