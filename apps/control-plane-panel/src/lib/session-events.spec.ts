import { describe, expect, it, vi } from "vitest"
import { ApiError } from "./api"
import { onSessionError, sessionTargetOf } from "./session-events"

describe("where a refusal of the session leads (adr/0061 Ek C4)", () => {
  it.each([
    [new ApiError(401, "cp.session_revoked", "unauthorized"), "/login"],
    [new ApiError(401, "Unauthorized", "unauthorized"), "/login"],
    [new ApiError(403, "cp.mfa_required", "not_allowed"), "/security/setup"],
    [new ApiError(403, "cp.no_role", "not_allowed"), "/no-access"],
    [new ApiError(403, "cp.forbidden", "not_allowed"), null],
    [new ApiError(428, "cp.step_up_required", "not_allowed"), null],
    [new TypeError("Failed to fetch"), null],
  ])("%s → %s", (error, target) => {
    expect(sessionTargetOf(error)).toBe(target)
  })

  it("signs out of the page on a 401: what was read is forgotten", () => {
    const navigate = vi.fn()
    const clear = vi.fn()
    onSessionError(new ApiError(401, "cp.session_revoked", "unauthorized"), {
      pathname: () => "/staff",
      navigate,
      clear,
    })
    expect(clear).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith("/login")
  })

  it("leaves the pages before sign-in to show their own refusal", () => {
    const navigate = vi.fn()
    onSessionError(new ApiError(401, "Invalid email or password", "unauthorized"), {
      pathname: () => "/login",
      navigate,
      clear: vi.fn(),
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})
