import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { editorSessionOf } from "../../../../lib/storefront/editor-session"
import { logger } from "../../../../lib/logging"
import { sessionHolds } from "../../../http/staff-sessions"
import { GET } from "../session/[token]/route"

/**
 * GET /store/storefront-layout/session/:token (adr/0065 §1; security review
 * 2026-11-15): Redis out of reach is a 404, never a 500, and the token is
 * not logged; the staff member's role is a plain read, never `roleOf`
 * (which can make a first user owner) on an unsigned request.
 */

jest.mock("../../../../lib/storefront/editor-session", () => ({
  editorSessionOf: jest.fn(),
  editorSessionStore: jest.fn(() => ({})),
}))
jest.mock("../../../../lib/orders/access-token", () => ({
  orderAccessKey: jest.fn(() => Buffer.alloc(32)),
}))
jest.mock("../../../../lib/logging", () => ({
  errorSummary: (error: unknown) => ({ message: (error as Error).message }),
  logger: { warn: jest.fn() },
}))
jest.mock("../../../http/staff-sessions", () => ({ sessionHolds: jest.fn() }))
jest.mock("../../../../modules/staff-roles", () => ({ STAFF_ROLES_MODULE: "staff_roles" }))
jest.mock("../../../../workflows/storefront/layout", () => ({
  layoutRow: jest.fn(() => Promise.resolve({ updated_at: new Date("2026-11-15T09:00:00Z") })),
}))
jest.mock("../draft", () => ({ draftLayout: jest.fn(() => Promise.resolve({ home: [] })) }))

// Shaped like a session token; what the route reads of it is mocked
const TOKEN = `sfs_${"0".repeat(32)}.abc.mac`
const RECORD = { user_id: "user_1", sid: "sid_1", created_at: 0, last_seen: 0 }

function call(roles = new Map<string, string>()) {
  const staffRoles = {
    rolesOf: jest.fn(() => Promise.resolve(roles)),
    roleOf: jest.fn(() => Promise.resolve("owner")),
  }
  const req = {
    params: { token: TOKEN },
    scope: { resolve: jest.fn(() => staffRoles) },
  } as unknown as MedusaStoreRequest
  const headers: Record<string, string> = {}
  const res = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value
    }),
    json: jest.fn(),
  } as unknown as MedusaResponse
  return { req, res, headers, staffRoles }
}

const notFound: unknown = expect.objectContaining({
  type: "not_found",
  message: "storefront_layout.session_unknown",
})

describe("the live preview session's store route", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("answers 404, not 500, when the session store is out of reach, and logs no token", async () => {
    jest.mocked(editorSessionOf).mockRejectedValueOnce(new Error("connect ECONNREFUSED"))
    const { req, res, headers } = call()
    await expect(GET(req, res)).rejects.toEqual(notFound)
    expect(headers["Cache-Control"]).toBe("private, no-store")
    expect(jest.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.objectContaining({ event: "editor_session.unreadable" })
    )
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain("sfs_")
    expect(sessionHolds).not.toHaveBeenCalled()
  })

  it("reads the role without ever making anyone owner", async () => {
    jest.mocked(editorSessionOf).mockResolvedValue(RECORD)
    jest.mocked(sessionHolds).mockResolvedValue(true)

    // No role held (an empty team included): a 404, and `roleOf` is never asked
    const none = call()
    await expect(GET(none.req, none.res)).rejects.toEqual(notFound)
    expect(none.staffRoles.rolesOf).toHaveBeenCalledWith(["user_1"])
    expect(none.staffRoles.roleOf).not.toHaveBeenCalled()

    const operations = call(new Map([["user_1", "operations"]]))
    await expect(GET(operations.req, operations.res)).rejects.toEqual(notFound)

    const admin = call(new Map([["user_1", "admin"]]))
    await GET(admin.req, admin.res)
    expect(admin.staffRoles.roleOf).not.toHaveBeenCalled()
    expect(jest.mocked(admin.res.json)).toHaveBeenCalledWith({
      layout: { home: [] },
      edition: "2026-11-15T09:00:00.000Z",
    })
  })
})
