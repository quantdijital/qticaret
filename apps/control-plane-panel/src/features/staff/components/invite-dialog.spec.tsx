import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { InviteDialog } from "./invite-dialog"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}
const SENT = { link: "http://localhost:5174/invite#token=abc", mailed: false }

function controlPlane(call: Sent): Answer {
  if (call.path === "/admin/cp/me/step-up") {
    return { status: 200, body: PROOF }
  }
  if (!call.headers[STEP_UP_HEADER]) {
    return refusal(428, "cp.step_up_required")
  }
  return { status: 201, body: { invite: {}, ...SENT } }
}

const dialog = (onSent = vi.fn()) => {
  renderAs(
    <>
      <InviteDialog open onOpenChange={vi.fn()} onSent={onSent} />
      <StepUpHost />
    </>,
    "owner"
  )
  return onSent
}

describe("InviteDialog (adr/0061 §3.5, 2026-11-12)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("offers every role, the owner's first as in the member dialog, operator chosen", async () => {
    stubApi(controlPlane)
    dialog()

    const radios = await screen.findAllByRole("radio")
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      "owner",
      "operator",
      "finance",
      "readonly",
    ])
    expect(screen.getByRole("radio", { name: /^Sahip/ })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: /^Operasyon/ })).toBeChecked()
    expect(
      screen.getByText("Her şey: personel, mağaza kapatma, anahtarlar ve denetim kaydı.")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Davet e-postayla gider. Rol, kişi iki adımlı doğrulamayı kurunca geçerli olur."
      )
    ).toBeInTheDocument()
  })

  it("invites an owner behind the step-up and hands the link back once", async () => {
    const sent = stubApi(controlPlane)
    const onSent = dialog()

    await userEvent.type(await screen.findByLabelText("E-posta"), " Yeni.Sahip@Quant.test ")
    await userEvent.click(screen.getByRole("radio", { name: /^Sahip/ }))
    await userEvent.click(screen.getByRole("button", { name: "Davet gönder" }))
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))

    await waitFor(() => {
      expect(onSent).toHaveBeenCalledWith(expect.objectContaining(SENT))
    })
    const invite = sent.filter((call) => call.path === "/admin/cp/staff/invites").at(-1)
    expect(invite?.body).toEqual({ email: "yeni.sahip@quant.test", role: "owner" })
    expect(invite?.headers[STEP_UP_HEADER]).toBe("proof-1")
  })
})
