import { afterEach, describe, expect, it, vi } from "vitest"
import { isTurnstileRefusal, postGated } from "./gated-post"

const answer = (status: number, body: Record<string, unknown>) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const headersOf = (fetch: ReturnType<typeof vi.fn>, call: number) =>
  (fetch.mock.calls[call]?.[1] as RequestInit).headers as Record<string, string>

describe("postGated (adr/0044 Ek 2026-11-24)", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asked for Turnstile (428), takes a token and sends once more", async () => {
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        answer(428, { code: "fraud.turnstile_required", turnstile: { action: "staff_register" } })
      )
      .mockReturnValueOnce(answer(200, { token: "jwt" }))
    vi.stubGlobal("fetch", fetch)
    const gate = {
      take: vi.fn().mockResolvedValueOnce(null).mockResolvedValue("tok"),
      spent: vi.fn(),
    }

    const result = await postGated("/auth/user/emailpass/register", {}, gate)

    expect(result.status).toBe(200)
    expect(headersOf(fetch, 0)["x-turnstile-token"]).toBeUndefined()
    expect(headersOf(fetch, 1)["x-turnstile-token"]).toBe("tok")
    expect(gate.spent).toHaveBeenCalledTimes(1)
  })

  it("hands a refused token (403) back without trying again, the widget reset", async () => {
    const fetch = vi
      .fn()
      .mockReturnValue(answer(403, { code: "fraud.turnstile_failed", turnstile: { action: "x" } }))
    vi.stubGlobal("fetch", fetch)
    const gate = { take: vi.fn().mockResolvedValue("tok"), spent: vi.fn() }

    const result = await postGated("/auth/user/emailpass", {}, gate)

    expect(result.status).toBe(403)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(gate.spent).toHaveBeenCalledTimes(1)
    expect(isTurnstileRefusal({ code: result.body.code })).toBe(true)
  })

  it("solves a 22-bit stand-in proof's difficulty within the solver's bound", async () => {
    const solve = await import("@/lib/challenge")
    const spy = vi.spyOn(solve, "solveChallenge").mockResolvedValue("9")
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        answer(428, {
          fallback: "turnstile_unavailable",
          challenge: { token: "ts_staff_login.s.22.1.sig", salt: "s", bits: 22 },
        })
      )
      .mockReturnValueOnce(answer(200, { token: "jwt" }))
    vi.stubGlobal("fetch", fetch)

    await postGated("/auth/user/emailpass", {}, null)

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ bits: 22 }))
    expect(headersOf(fetch, 1)["x-turnstile-fallback"]).toBe("ts_staff_login.s.22.1.sig.9")
  })
})
