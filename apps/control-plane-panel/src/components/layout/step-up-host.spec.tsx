import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { api } from "@/lib/api"
import { STEP_UP_HEADER, forgetStepUp, isStepUpCancelled, withStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import { StepUpHost } from "./step-up-host"

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const deactivate = () =>
  withStepUp((headers) =>
    api("/admin/cp/staff/members/user_2/deactivate", { method: "POST", body: {}, headers })
  )

describe("StepUpHost: the re-authentication dialog", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("opens on a 428, retries the change with the proof and closes", async () => {
    const sent = stubApi((call) => {
      if (call.path === "/admin/cp/me/step-up") {
        return { status: 200, body: PROOF }
      }
      return call.headers[STEP_UP_HEADER]
        ? { status: 200, body: { member: { id: "user_2", active: false } } }
        : refusal(428, "cp.step_up_required")
    })
    render(<StepUpHost />)

    const done = deactivate()
    const dialog = await screen.findByRole("dialog", { name: "Kimliğinizi doğrulayın" })
    const confirm = screen.getByRole("button", { name: "Doğrula" })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(confirm)

    await expect(done).resolves.toEqual({ member: { id: "user_2", active: false } })
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument()
    })
    expect(sent.at(-1)?.headers[STEP_UP_HEADER]).toBe("proof-1")
  })

  it("says a wrong code in the dialog and stays open", async () => {
    stubApi((call) =>
      call.path === "/admin/cp/me/step-up"
        ? refusal(403, "cp.step_up_failed")
        : refusal(428, "cp.step_up_required")
    )
    render(<StepUpHost />)

    void deactivate().catch(() => undefined)
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Kod doğru değil")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("takes a recovery code", async () => {
    const sent = stubApi((call) =>
      call.path === "/admin/cp/me/step-up"
        ? { status: 200, body: PROOF }
        : call.headers[STEP_UP_HEADER]
          ? { status: 200, body: {} }
          : refusal(428, "cp.step_up_required")
    )
    render(<StepUpHost />)

    const done = deactivate()
    await userEvent.click(await screen.findByRole("button", { name: "Kurtarma kodu kullan" }))
    await userEvent.type(screen.getByLabelText("Kurtarma kodu"), "ABCD-EFGH")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await done
    expect(sent[1]?.body).toEqual({ method: "recovery_code", code: "ABCD-EFGH" })
  })

  it("makes no change when closed", async () => {
    stubApi(() => refusal(428, "cp.step_up_required"))
    render(<StepUpHost />)

    const done = deactivate().catch((error: unknown) => error)
    await userEvent.click(await screen.findByRole("button", { name: "Vazgeç" }))

    expect(isStepUpCancelled(await done)).toBe(true)
  })
})
