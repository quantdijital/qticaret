import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "../errors"

// The request's headers and cookies (no session), and the backend's answers as the test sets them
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))
vi.mock("../../env", () => ({ storefrontEnv: () => ({ NODE_ENV: "test" }) }))
const core = vi.hoisted(() => ({ storeRequest: vi.fn() }))
vi.mock("../core", () => core)

const { storePublicFind } = await import("../server")
const { forgetShared } = await import("../shared")

describe("storePublicFind", () => {
  beforeEach(() => {
    core.storeRequest.mockReset()
    forgetShared(["/store/legal/"])
  })

  it("keeps a 404 a minute as 'not published': the next page does not ask again", async () => {
    core.storeRequest.mockRejectedValue(new StoreApiError(404, "errors.not_found", null))
    await expect(storePublicFind("/store/legal/cookie_policy")).resolves.toBeNull()
    await expect(storePublicFind("/store/legal/cookie_policy")).resolves.toBeNull()
    expect(core.storeRequest).toHaveBeenCalledTimes(1)
  })

  it("keeps a found answer the same way", async () => {
    core.storeRequest.mockResolvedValue({ data: { document: { kind: "membership" } } })
    await storePublicFind("/store/legal/membership")
    await expect(storePublicFind("/store/legal/membership")).resolves.toEqual({
      document: { kind: "membership" },
    })
    expect(core.storeRequest).toHaveBeenCalledTimes(1)
  })

  it("never keeps a 5xx or a timeout: the next page asks again", async () => {
    core.storeRequest.mockRejectedValueOnce(new StoreApiError(503, null, null))
    await expect(storePublicFind("/store/legal/return_policy")).rejects.toThrow("503")
    await Promise.resolve()
    core.storeRequest.mockRejectedValueOnce(new Error("timeout"))
    await expect(storePublicFind("/store/legal/return_policy")).rejects.toThrow("timeout")
    await Promise.resolve()
    core.storeRequest.mockResolvedValueOnce({ data: { document: { kind: "return_policy" } } })
    await expect(storePublicFind("/store/legal/return_policy")).resolves.toEqual({
      document: { kind: "return_policy" },
    })
    expect(core.storeRequest).toHaveBeenCalledTimes(3)
  })

  it("is dropped by the legal refresh like any answer of its path", async () => {
    core.storeRequest.mockRejectedValue(new StoreApiError(404, null, null))
    await storePublicFind("/store/legal/distance_sales")
    expect(forgetShared(["/store/legal/"])).toBe(1)
    await storePublicFind("/store/legal/distance_sales")
    expect(core.storeRequest).toHaveBeenCalledTimes(2)
  })
})
