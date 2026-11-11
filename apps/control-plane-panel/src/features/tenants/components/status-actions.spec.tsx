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
import { moveOf } from "@/features/tenants/status-move"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const BASE = "/admin/cp/tenants/ten_kahve"
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}
const REASON = "Sözleşme ihlali incelemesi"

const shopIn = (status: TenantStatus): TenantDetail => ({
  ...SHOP,
  tenant: { ...SHOP.tenant, status },
})

function controlPlane(status: TenantStatus, moved: Answer | null = null) {
  return (call: Sent): Answer => {
    if (call.path === BASE && call.method === "GET") {
      return { status: 200, body: shopIn(status) }
    }
    if (call.path === `${BASE}/suspend` || call.path === `${BASE}/resume`) {
      if (!call.headers[STEP_UP_HEADER]) {
        return refusal(428, "cp.step_up_required")
      }
      return moved ?? { status: 200, body: { tenant: { id: "ten_kahve", status: "suspended" } } }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    if (call.path.startsWith(`${BASE}/activity`)) {
      return {
        status: 200,
        body: {
          items: [
            {
              id: "tensc_2",
              kind: "status",
              at: "2026-11-11T12:00:00.000Z",
              actor: "Deniz Kaya",
              from_status: "active",
              to_status: "suspended",
              reason_code: "staff_suspend",
              note: REASON,
            },
          ],
          next_before: null,
        },
      }
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

describe("a shop's suspension and its end on its page (adr/0061 Ek C15)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.params = { id: "ten_kahve" }
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("offers each move from where the shop stands", () => {
    expect(moveOf("active")).toBe("suspend")
    expect(moveOf("restricted")).toBe("suspend")
    expect(moveOf("suspended")).toBe("resume")
    for (const status of ["provisioning", "closing", "closed"] as const) {
      expect(moveOf(status)).toBeNull()
    }
  })

  it("suspends an active shop with a reason, behind the step-up", async () => {
    const sent = stubApi(controlPlane("active"))
    page("operator")

    await userEvent.click(await screen.findByRole("button", { name: "Askıya al" }))
    const dialog = await screen.findByRole("dialog", { name: "Mağazayı askıya al" })
    const submit = within(dialog).getByRole("button", { name: "Askıya al" })
    expect(submit).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText("Gerekçe"), REASON)
    await userEvent.click(submit)
    await proveWithCode()

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Mağazayı askıya al" })).not.toBeInTheDocument()
    })
    const moves = sent.filter((call) => call.path === `${BASE}/suspend`)
    expect(moves.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
    expect(moves[1]?.body).toEqual({ reason: REASON })
  })

  it("ends a suspension, and shows the move's reason in the activity", async () => {
    routerState.search = { part: "activity" }
    const sent = stubApi(
      controlPlane("suspended", { status: 200, body: { tenant: { status: "active" } } })
    )
    page("owner")

    expect(await screen.findByText(`“${REASON}”`)).toBeInTheDocument()
    expect(screen.getByText(/personel askıya aldı/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Geri aç" }))
    const dialog = await screen.findByRole("dialog", { name: "Askıyı kaldır" })
    await userEvent.type(within(dialog).getByLabelText("Gerekçe"), "Ödeme alındı")
    await userEvent.click(within(dialog).getByRole("button", { name: "Geri aç" }))
    await proveWithCode()

    await waitFor(() => {
      expect(
        sent.some((call) => call.path === `${BASE}/resume` && call.headers[STEP_UP_HEADER])
      ).toBe(true)
    })
  })

  it("says why a move was refused, in the dialog", async () => {
    stubApi(controlPlane("active", refusal(409, "cp.status_transition")))
    page("operator")

    await userEvent.click(await screen.findByRole("button", { name: "Askıya al" }))
    const dialog = await screen.findByRole("dialog", { name: "Mağazayı askıya al" })
    await userEvent.type(within(dialog).getByLabelText("Gerekçe"), REASON)
    await userEvent.click(within(dialog).getByRole("button", { name: "Askıya al" }))
    await proveWithCode()

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Mağaza bu duruma geçemez.")
  })

  it("offers neither move to finance and readers, nor to a shop being set up", async () => {
    for (const [role, status] of [
      ["finance", "active"],
      ["readonly", "suspended"],
      ["owner", "provisioning"],
    ] as const) {
      stubApi(controlPlane(status))
      const { unmount } = page(role)
      await screen.findByRole("heading", { level: 1, name: "Kahve Durağı" })
      expect(screen.queryByRole("button", { name: "Askıya al" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Geri aç" })).not.toBeInTheDocument()
      unmount()
      vi.unstubAllGlobals()
    }
  })
})
