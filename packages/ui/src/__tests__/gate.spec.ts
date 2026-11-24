import { describe, expect, it, vi } from "vitest"
import type { FormGates, GatedResult, GateHandle } from "../lib/gate"
import { CHALLENGE_FAILED, sendGated, TURNSTILE_FAILED } from "../lib/gate"

vi.mock("../lib/challenge", () => ({
  solveChallenge: vi.fn(() => Promise.resolve("7")),
  challengeAnswer: (token: string, nonce: string) => `${token}.${nonce}`,
}))

/** `sendGated`: a form's send past Turnstile and the proof of work (adr/0044 Ek 2026-11-24). */

const OK: GatedResult = { ok: true, error: null, challenge: null }
const asked = (action: string, failed = false): GatedResult => ({
  ok: false,
  error: null,
  challenge: null,
  turnstile: { action, failed },
})

function widget(eager = false) {
  let made = 0
  let armed = eager
  const handle = {
    eager: () => armed,
    take: vi.fn(() => {
      armed = true
      made += 1
      return Promise.resolve(`tok-${String(made)}`)
    }),
    spent: vi.fn(),
  } satisfies GateHandle
  return handle
}

/** A send that answers in turn and keeps what each send carried. */
function backend(answers: GatedResult[]) {
  const seen: Record<string, string>[] = []
  const send = vi.fn((form: FormData) => {
    seen.push(
      Object.fromEntries(
        [...form.entries()].map(([key, value]) => [
          key,
          typeof value === "string" ? value : value.name,
        ])
      )
    )
    return Promise.resolve(answers.shift() ?? OK)
  })
  return { send, seen }
}

const gatesOf = (own: string, gates: FormGates["gates"]): FormGates => ({ own, gates })

describe("sendGated", () => {
  it("sends an every-send gate's token with the first send, then resets the widget", async () => {
    const login = widget(true)
    const { send, seen } = backend([OK])

    await expect(sendGated(send, new FormData(), gatesOf("login", { login }))).resolves.toEqual(OK)

    expect(seen[0]?.["turnstile"]).toBe("tok-1")
    expect(login.spent).toHaveBeenCalledTimes(1)
  })

  it("asked past the limit (428), takes a token and sends once more; later sends carry one at once", async () => {
    const newsletter = widget()
    const { send, seen } = backend([asked("newsletter"), OK, OK])
    const gates = gatesOf("newsletter", { newsletter })

    await expect(sendGated(send, new FormData(), gates)).resolves.toEqual(OK)
    expect(seen[0]?.["turnstile"]).toBeUndefined()
    expect(seen[1]?.["turnstile"]).toBe("tok-1")

    await sendGated(send, new FormData(), gates)
    expect(seen[2]?.["turnstile"]).toBe("tok-2")
  })

  it("a refused token (403) is said, not tried again; the widget is reset for the next send", async () => {
    const checkout = widget(true)
    const { send } = backend([asked("checkout", true)])

    const result = await sendGated(send, new FormData(), gatesOf("checkout", { checkout }))

    expect(result).toMatchObject({ ok: false, error: TURNSTILE_FAILED, turnstile: null })
    expect(send).toHaveBeenCalledTimes(1)
    expect(checkout.spent).toHaveBeenCalledTimes(1)
  })

  it("asks Turnstile once more at most, then says it failed", async () => {
    const review = widget()
    const { send } = backend([asked("review"), asked("review"), asked("review")])

    const result = await sendGated(send, new FormData(), gatesOf("review", { review }))

    expect(result.error).toBe(TURNSTILE_FAILED)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("without a site key, a 428 cannot be answered and is said", async () => {
    const { send } = backend([asked("contact")])

    const result = await sendGated(send, new FormData(), gatesOf("contact", { contact: null }))

    expect(result.error).toBe(TURNSTILE_FAILED)
  })

  it("answers the soft limit's proof in `challenge` and Turnstile's stand-in in `turnstile_fallback`", async () => {
    const { send, seen } = backend([
      {
        ok: false,
        error: null,
        challenge: { token: "ts_login.s.22.1.sig", salt: "s", bits: 22, fallback: true },
      },
      { ok: false, error: null, challenge: { token: "login.s.18.1.sig", salt: "s", bits: 18 } },
      OK,
    ])

    await expect(
      sendGated(send, new FormData(), gatesOf("login", { login: null }))
    ).resolves.toEqual(OK)

    expect(seen[1]?.["turnstile_fallback"]).toBe("ts_login.s.22.1.sig.7")
    expect(seen[1]?.["challenge"]).toBeUndefined()
    // The stand-in is single use: not sent again with the next answer
    expect(seen[2]?.["turnstile_fallback"]).toBeUndefined()
    expect(seen[2]?.["challenge"]).toBe("login.s.18.1.sig.7")
  })

  it("a second gate's token and stand-in go in its own fields (a sign-in's verification code)", async () => {
    const login = widget(true)
    const verification = widget()
    const { send, seen } = backend([
      asked("verification"),
      {
        ok: false,
        error: null,
        challenge: {
          token: "ts_verification.s.18.1.sig",
          salt: "s",
          bits: 18,
          fallback: true,
          action: "verification",
        },
      },
      OK,
    ])

    await sendGated(send, new FormData(), gatesOf("login", { login, verification }))

    expect(seen[0]).toMatchObject({ turnstile: "tok-1" })
    expect(seen[0]?.["turnstile:verification"]).toBeUndefined()
    // Asked: the sign-in is sent again with a fresh token of its own, beside the code's
    expect(seen[1]).toMatchObject({ turnstile: "tok-2", "turnstile:verification": "tok-1" })
    expect(seen[2]?.["turnstile_fallback:verification"]).toBe("ts_verification.s.18.1.sig.7")
  })

  it("a proof it cannot solve is said as the check's failure", async () => {
    const { solveChallenge } = await import("../lib/challenge")
    vi.mocked(solveChallenge).mockRejectedValueOnce(new Error("too hard"))
    const { send } = backend([
      { ok: false, error: null, challenge: { token: "t", salt: "s", bits: 30 } },
    ])

    const result = await sendGated(send, new FormData(), null)

    expect(result.error).toBe(CHALLENGE_FAILED)
  })

  it("sends again what the action already did in place of what was sent (a review's photos)", async () => {
    const review = widget()
    const { send, seen } = backend([
      { ...asked("review"), resume: { photo_ids: ["revph_1", "revph_2"], photos: [] } },
      OK,
    ])
    const form = new FormData()
    form.append("photos", new File(["x"], "a.jpg", { type: "image/jpeg" }))

    await sendGated(send, form, gatesOf("review", { review }))

    expect(seen[0]?.["photos"]).toBe("a.jpg")
    expect(seen[1]?.["photos"]).toBeUndefined()
    expect(form.getAll("photo_ids")).toEqual(["revph_1", "revph_2"])
    expect(seen[1]?.["turnstile"]).toBe("tok-1")
  })
})
