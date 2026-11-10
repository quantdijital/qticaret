import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { api } from "./api"
import {
  STEP_UP_HEADER,
  StepUpCancelled,
  forgetStepUp,
  setStepUpAsker,
  withStepUp,
} from "./step-up"
import type { StepUpAsk } from "./step-up"

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

/** The control plane: a role change that asks a proof; the step-up route takes "123456" only. */
function controlPlane(call: Sent): Answer {
  if (call.path === "/admin/cp/me/step-up") {
    const { code } = call.body as { code: string }
    return code === "123456" ? { status: 200, body: PROOF } : refusal(403, "cp.step_up_failed")
  }
  return call.headers[STEP_UP_HEADER] === "proof-1"
    ? { status: 200, body: { member: { id: "user_1", role: "finance" } } }
    : refusal(428, "cp.step_up_required")
}

const changeRole = () =>
  withStepUp((headers) =>
    api("/admin/cp/staff/members/user_1", { method: "POST", body: { role: "finance" }, headers })
  )

describe("withStepUp (adr/0061 Ek C4)", () => {
  const asks: StepUpAsk[] = []
  beforeEach(() => {
    forgetStepUp()
    asks.length = 0
  })
  afterEach(() => {
    setStepUpAsker(null)
    vi.unstubAllGlobals()
  })

  it("asks on a 428, proves the code and makes the change again with the proof", async () => {
    const sent = stubApi(controlPlane)
    setStepUpAsker((ask) => {
      asks.push(ask)
      ask.answer({ method: "totp", code: "123456" })
    })

    await expect(changeRole()).resolves.toEqual({ member: { id: "user_1", role: "finance" } })

    expect(asks).toHaveLength(1)
    expect(sent.map((call) => call.path)).toEqual([
      "/admin/cp/staff/members/user_1",
      "/admin/cp/me/step-up",
      "/admin/cp/staff/members/user_1",
    ])
    expect(sent[1]?.body).toEqual({ method: "totp", code: "123456" })
    expect(sent[2]?.headers[STEP_UP_HEADER]).toBe("proof-1")
  })

  it("asks again, saying so, after a wrong code", async () => {
    stubApi(controlPlane)
    const codes = ["000000", "123456"]
    setStepUpAsker((ask) => {
      asks.push(ask)
      ask.answer({ method: "totp", code: codes.shift() ?? "" })
    })

    await changeRole()

    expect(asks.map((ask) => ask.failed)).toEqual([false, true])
  })

  it("keeps the proof for the next change while it holds: one code for several changes", async () => {
    const sent = stubApi(controlPlane)
    setStepUpAsker((ask) => {
      asks.push(ask)
      ask.answer({ method: "recovery_code", code: "123456" })
    })

    await changeRole()
    await changeRole()

    expect(asks).toHaveLength(1)
    expect(sent.at(-1)?.headers[STEP_UP_HEADER]).toBe("proof-1")
  })

  it("forgets the proof on sign-out", async () => {
    stubApi(controlPlane)
    setStepUpAsker((ask) => {
      asks.push(ask)
      ask.answer({ method: "totp", code: "123456" })
    })

    await changeRole()
    forgetStepUp()
    await changeRole()

    expect(asks).toHaveLength(2)
  })

  it("makes no change when the dialog is closed", async () => {
    stubApi(controlPlane)
    setStepUpAsker((ask) => {
      ask.answer(null)
    })

    await expect(changeRole()).rejects.toBeInstanceOf(StepUpCancelled)
  })

  it("passes a lock through instead of asking forever", async () => {
    stubApi((call) =>
      call.path === "/admin/cp/me/step-up"
        ? refusal(429, "cp.step_up_locked", "too_many_requests")
        : refusal(428, "cp.step_up_required")
    )
    setStepUpAsker((ask) => {
      ask.answer({ method: "totp", code: "123456" })
    })

    await expect(changeRole()).rejects.toMatchObject({ status: 429, code: "cp.step_up_locked" })
  })

  it("leaves other refusals alone", async () => {
    stubApi(() => refusal(403, "cp.last_owner"))
    setStepUpAsker((ask) => {
      asks.push(ask)
    })

    await expect(changeRole()).rejects.toMatchObject({ status: 403, code: "cp.last_owner" })
    expect(asks).toHaveLength(0)
  })
})
