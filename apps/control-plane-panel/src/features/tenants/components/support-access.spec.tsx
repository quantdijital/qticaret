import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { TenantDetail } from "@/features/tenants/api"
import { TenantPage } from "@/features/tenants/pages/tenant-page"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"
import { SHOP } from "@/test/shops"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const BASE = "/admin/cp/tenants/ten_kahve"
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}
const REASON = "Ürün girişi ve vitrin düzeni için kurulum desteği"
const LINK = "http://localhost:10200/support#grant=abc"
const GRANT = { url: LINK, grant_id: "sgr_x", expires_at: "2026-11-28T11:00:00.000Z" }

const shopIn = (status: TenantStatus): TenantDetail => ({
  ...SHOP,
  tenant: { ...SHOP.tenant, status },
})

function controlPlane(status: TenantStatus, issued: Answer | null = null) {
  return (call: Sent): Answer => {
    if (call.path === BASE && call.method === "GET") {
      return { status: 200, body: shopIn(status) }
    }
    if (call.path === `${BASE}/support-grants`) {
      if (!call.headers[STEP_UP_HEADER]) {
        return refusal(428, "cp.step_up_required")
      }
      return issued ?? { status: 200, body: GRANT }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (call.path.startsWith(`${BASE}/activity`)) {
      return { status: 200, body: { items: [], next_before: null } }
    }
    if (call.path === `${BASE}/provisioning` && call.method === "GET") {
      return { status: 200, body: { provisioner: "local", latest: null, runs: [] } }
    }
    return { status: 200, body: {} }
  }
}

const page = (role: Parameters<typeof renderAs>[1]) =>
  renderAs(
    <>
      <TenantPage />
      <StepUpHost />
    </>,
    role
  )

async function proveWithCode() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

async function ask(reason = REASON) {
  await userEvent.click(await screen.findByRole("button", { name: "Mağaza paneline geç" }))
  const dialog = await screen.findByRole("dialog", { name: "Mağaza paneline geç" })
  const submit = within(dialog).getByRole("button", { name: "İzin oluştur" })
  expect(submit).toBeDisabled()
  const field = within(dialog).getByLabelText("Gerekçe")
  expect(field).toHaveAttribute("placeholder", expect.stringMatching(/^Örn\./))
  await userEvent.type(field, reason)
  return { dialog, submit }
}

describe("going to a shop's panel from its page (adr/0061 Ek 2026-11-28)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.params = { id: "ten_kahve" }
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("asks a reason and a length, proves the member again, then offers the link once", async () => {
    const sent = stubApi(controlPlane("active"))
    page("operator")

    const { dialog, submit } = await ask()
    await userEvent.click(within(dialog).getByLabelText("60 dakika"))
    await userEvent.click(submit)
    await proveWithCode()

    const ready = await screen.findByRole("dialog", { name: "Bağlantı hazır" })
    const open = within(ready).getByRole("link", { name: "Paneli aç" })
    expect(open).toHaveAttribute("href", LINK)
    expect(open).toHaveAttribute("target", "_blank")
    expect(open).toHaveAttribute("rel", "noopener noreferrer")
    const grants = sent.filter((call) => call.path === `${BASE}/support-grants`)
    expect(grants.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
    expect(grants[1]?.body).toEqual({ reason: REASON, minutes: 60 })

    await userEvent.click(within(ready).getByRole("button", { name: "Kapat" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Bağlantı hazır" })).not.toBeInTheDocument()
    })
  })

  it("sends thirty minutes unless another is chosen, the reason on one line", async () => {
    const sent = stubApi(controlPlane("suspended"))
    page("owner")

    const { submit } = await ask("Vitrin düzeni{Enter}ve ürün girişi")
    await userEvent.click(submit)
    await proveWithCode()

    await screen.findByRole("dialog", { name: "Bağlantı hazır" })
    const grant = sent.filter((call) => call.path === `${BASE}/support-grants`).at(-1)
    expect(grant?.body).toEqual({ reason: "Vitrin düzeni ve ürün girişi", minutes: 30 })
  })

  it("says why a grant was refused, in the dialog", async () => {
    stubApi(controlPlane("active", refusal(409, "cp.support_unavailable")))
    page("operator")

    const { dialog, submit } = await ask()
    await userEvent.click(submit)
    await proveWithCode()

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Kurulumu süren ya da kapanan mağazanın paneline geçilemez."
    )
  })

  it("is offered to neither finance nor readers, nor on a shop being set up", async () => {
    for (const [role, status] of [
      ["finance", "active"],
      ["readonly", "active"],
      ["owner", "provisioning"],
      ["operator", "closed"],
    ] as const) {
      stubApi(controlPlane(status))
      const { unmount } = page(role)
      await screen.findByRole("heading", { level: 1, name: "Kahve Durağı" })
      expect(screen.queryByRole("button", { name: "Mağaza paneline geç" })).not.toBeInTheDocument()
      unmount()
      vi.unstubAllGlobals()
    }
  })
})
