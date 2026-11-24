import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const removeSessions = jest.fn().mockResolvedValue(undefined)
const removeUser = jest.fn().mockResolvedValue(undefined)

jest.mock("../../../lib/staff/account-store", () => ({
  staffAccountStore: () => ({ removeSessions }),
}))
jest.mock("../../../lib/ai/assistant/conversation", () => ({
  conversationStore: () => ({ removeUser }),
}))

import { noteSessionEnd } from "../staff-sessions"

/** adr/0079 §6 (security review D2): signing out drops the assistant's conversations at once. */

const requestOf = (auth: { actor_type: string; actor_id: string } | null) =>
  ({ session: { auth_context: auth }, sessionID: "s1" }) as unknown as MedusaRequest

describe("a staff member signing out", () => {
  beforeEach(() => {
    removeSessions.mockClear()
    removeUser.mockClear()
  })

  it("drops the member's assistant conversations with the session's note", () => {
    const next = jest.fn()
    noteSessionEnd(
      requestOf({ actor_type: "user", actor_id: "user_1" }),
      {} as MedusaResponse,
      next
    )

    expect(removeSessions).toHaveBeenCalledWith("user_1", ["s1"])
    expect(removeUser).toHaveBeenCalledWith("user_1")
    expect(next).toHaveBeenCalled()
  })

  it("signs out even when the conversations cannot be dropped", async () => {
    removeUser.mockRejectedValueOnce(new Error("redis down"))
    const next = jest.fn()
    noteSessionEnd(
      requestOf({ actor_type: "user", actor_id: "user_1" }),
      {} as MedusaResponse,
      next
    )
    await new Promise((resolve) => setImmediate(resolve))

    expect(next).toHaveBeenCalledTimes(1)
  })

  it("leaves a customer's sign-out alone", () => {
    noteSessionEnd(
      requestOf({ actor_type: "customer", actor_id: "cus_1" }),
      {} as MedusaResponse,
      jest.fn()
    )

    expect(removeUser).not.toHaveBeenCalled()
  })
})
