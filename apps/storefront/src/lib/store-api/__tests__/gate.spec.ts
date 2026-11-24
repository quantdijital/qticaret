import { describe, expect, it } from "vitest"
import { StoreApiError } from "../errors"
import { gateAsk, gated, gateHeaders, underGate } from "../gate"

/** The bot checks' answers from a theme's form to the backend, and back (adr/0044 Ek 2026-11-24). */

const formOf = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  return form
}

describe("gateHeaders", () => {
  it("sends the form's answers as the backend's headers", () => {
    expect(
      gateHeaders(
        formOf({
          challenge: "login.s.18.1.sig.7",
          turnstile: "0.AbC_d-e",
          turnstile_fallback: "ts.x.9",
        })
      )
    ).toEqual({
      "x-challenge": "login.s.18.1.sig.7",
      "x-turnstile-token": "0.AbC_d-e",
      "x-turnstile-fallback": "ts.x.9",
    })
    expect(gated(formOf({ email: "a@b.example" }))).toEqual({})
  })

  it("sends nothing that is not of its shape (no header injection, no overlong token)", () => {
    expect(
      gateHeaders(
        formOf({
          turnstile: "tok\r\nx-evil: 1",
          challenge: "a b",
          turnstile_fallback: "x".repeat(301),
        })
      )
    ).toEqual({})
    expect(gateHeaders(formOf({ turnstile: "x".repeat(2049) }))).toEqual({})
    expect(gateHeaders(formOf({ turnstile: "x".repeat(2048) }))).toHaveProperty("x-turnstile-token")
  })

  it("gives a second gate's call its own token and stand-in, never the form's proof", () => {
    const form = formOf({
      challenge: "login.s.18.1.sig.7",
      turnstile: "own",
      "turnstile:verification": "code",
      "turnstile_fallback:verification": "ts_verification.s.18.1.sig.3",
    })
    expect(gateHeaders(form, "verification")).toEqual({
      "x-turnstile-token": "code",
      "x-turnstile-fallback": "ts_verification.s.18.1.sig.3",
    })
  })
})

describe("gateAsk", () => {
  it("hands Turnstile's ask (428) and refusal (403) back with its gate", () => {
    expect(
      gateAsk(
        new StoreApiError(428, "fraud.turnstile_required", null, { turnstile: { action: "login" } })
      )
    ).toEqual({
      ok: false,
      error: null,
      challenge: null,
      turnstile: { action: "login", failed: false },
    })
    expect(
      gateAsk(
        new StoreApiError(403, "fraud.turnstile_failed", null, { turnstile: { action: "login" } })
      )
    ).toMatchObject({ turnstile: { action: "login", failed: true } })
    expect(gateAsk(new StoreApiError(403, "fraud.refused", null, {}))).toBeNull()
    expect(gateAsk(new Error("network"))).toBeNull()
  })

  it("marks a stand-in proof, and names the second gate it stands in for", async () => {
    const challenge = { token: "ts_verification.s.22.1.sig", salt: "s", bits: 22 }
    const error = new StoreApiError(428, "fraud.challenge_required", null, {
      challenge,
      fallback: "turnstile_unavailable",
    })
    expect(gateAsk(error)).toEqual({
      ok: false,
      error: null,
      challenge: { ...challenge, fallback: true },
    })
    const marked = await underGate("verification", () => Promise.reject(error)).catch(
      (thrown: unknown) => thrown
    )
    expect(gateAsk(marked)?.challenge).toEqual({
      ...challenge,
      fallback: true,
      action: "verification",
    })
    // The soft limit's proof stays as it was
    const soft = { token: "login.s.18.1.sig", salt: "s", bits: 18 }
    expect(
      gateAsk(new StoreApiError(428, "fraud.challenge_required", null, { challenge: soft }))
    ).toEqual({ ok: false, error: null, challenge: soft })
  })
})
