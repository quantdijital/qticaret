import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ME_KEY } from "@/features/auth/api"
import type { Me } from "@/features/auth/api"
import { holdEnrolmentToken } from "@/lib/link-token"
import { refusal, renderWithQuery, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { EnrolPage } from "./enrol-page"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
const STARTED = { secret: SECRET, otpauth_url: `otpauth://totp/x?secret=${SECRET}` }
const CODES = ["AAAA-BBBB-CCCC", "DDDD-EEEE-FFFF"]

const member = (fields: Partial<Me> = {}): Me => ({
  id: "user_1",
  email: "yeni@quant.test",
  first_name: "Yeni",
  last_name: "Üye",
  role: "operator",
  pending: true,
  enrol_by: null,
  enrolment_token_required: false,
  mfa: { required: true, enabled: false, passed: false },
  ...fields,
})

function renderPage(me: Me) {
  const view = renderWithQuery(<EnrolPage />)
  view.client.setQueryData(ME_KEY, me)
  return view
}

async function confirm(password = "uzun-bir-sifre-123") {
  await userEvent.type(await screen.findByLabelText("Uygulamadaki 6 haneli kod"), "123456")
  await userEvent.type(screen.getByLabelText("Şifreniz"), password)
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

const controlPlane =
  (verify: Answer) =>
  (call: Sent): Answer =>
    call.path === "/admin/cp/me/mfa" ? { status: 200, body: STARTED } : verify

describe("EnrolPage (adr/0061 Ek C4)", () => {
  beforeEach(() => {
    navigate.mockReset()
    holdEnrolmentToken(null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts the factor, takes the first code with the password, shows the codes once", async () => {
    const sent = stubApi(controlPlane({ status: 200, body: { recovery_codes: CODES } }))
    renderPage(member())

    expect(await screen.findByLabelText("Kurulum anahtarı")).toHaveTextContent("JBSW Y3DP")
    await confirm()

    expect(await screen.findByRole("list", { name: "Kurtarma kodları" })).toHaveTextContent(
      "AAAA-BBBB-CCCC"
    )
    expect(sent.find((call) => call.path === "/admin/cp/me/mfa/verify")?.body).toEqual({
      code: "123456",
      password: "uzun-bir-sifre-123",
    })
    // Kept, the codes leave the page; then a new sign-in with the code
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Kodları güvenli bir yere kaydettim" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Devam" }))
    expect(screen.queryByText("AAAA-BBBB-CCCC")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Yeniden giriş yap" }))
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/login" })
    })
  })

  it("says a wrong password in words (cp.password_invalid)", async () => {
    stubApi(controlPlane(refusal(403, "cp.password_invalid")))
    renderPage(member())

    await confirm("yanlis")

    expect(await screen.findByRole("alert")).toHaveTextContent("Şifre doğru değil.")
  })

  it("sends the e-mailed link's token after an owner's reset", async () => {
    const sent = stubApi(controlPlane({ status: 200, body: { recovery_codes: CODES } }))
    holdEnrolmentToken("enrol-token-from-the-link")
    renderPage(member({ enrolment_token_required: true }))

    await confirm()

    await screen.findByRole("list", { name: "Kurtarma kodları" })
    expect(sent.find((call) => call.path === "/admin/cp/me/mfa/verify")?.body).toMatchObject({
      enrolment_token: "enrol-token-from-the-link",
    })
  })

  it("asks for the link when a reset requires it and none was opened", async () => {
    stubApi(controlPlane({ status: 200, body: {} }))
    renderPage(member({ enrolment_token_required: true }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Kurulum bağlantısı gerekli")
  })
})
