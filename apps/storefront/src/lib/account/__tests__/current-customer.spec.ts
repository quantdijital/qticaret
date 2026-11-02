import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

// The session cookie as the test sets it, and the backend's answers
const jar = vi.hoisted(() => ({ session: undefined as string | undefined }))
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === "qt_session" && jar.session ? { value: jar.session } : undefined,
    }),
}))
vi.mock("@/lib/env", () => ({ storefrontEnv: () => ({ NODE_ENV: "test" }) }))
const core = vi.hoisted(() => ({ storeRequest: vi.fn() }))
vi.mock("@/lib/store-api/core", () => core)

const { currentCustomer } = await import("../auth")

const token = (claims: Record<string, unknown>) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`

describe("currentCustomer", () => {
  beforeEach(() => {
    core.storeRequest.mockReset()
    jar.session = undefined
  })

  it("asks nothing without a session cookie: a visitor is a guest", async () => {
    await expect(currentCustomer()).resolves.toBeNull()
    expect(core.storeRequest).not.toHaveBeenCalled()
  })

  it("asks nothing with a token past its end (it would not be sent)", async () => {
    jar.session = token({ actor_id: "cus_1", exp: Math.floor(Date.now() / 1000) - 60 })
    await expect(currentCustomer()).resolves.toBeNull()
    expect(core.storeRequest).not.toHaveBeenCalled()
  })

  it("asks with a live session, and a refused key is a guest", async () => {
    jar.session = token({ actor_id: "cus_1", exp: Math.floor(Date.now() / 1000) + 3600 })
    core.storeRequest.mockResolvedValueOnce({ data: { customer: { id: "cus_1" } } })
    await expect(currentCustomer()).resolves.toEqual({ id: "cus_1" })
    expect(core.storeRequest).toHaveBeenCalledWith(
      "/store/customers/me",
      expect.objectContaining({
        headers: { authorization: `Bearer ${jar.session}` },
      })
    )
    core.storeRequest.mockRejectedValueOnce(new StoreApiError(401, null, null))
    await expect(currentCustomer()).resolves.toBeNull()
  })
})
