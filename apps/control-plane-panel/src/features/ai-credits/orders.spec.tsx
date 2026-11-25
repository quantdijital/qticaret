import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Toaster } from "@qticaret/admin-ui/patterns/toaster"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { AiOrder } from "@/features/ai-credits/api/schemas"
import { OrdersPage } from "@/features/ai-credits/pages/orders-page"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const ORDER: AiOrder = {
  id: "aico_1",
  tenant_id: "ten_kahve",
  tenant: { name: "Kahve Durağı", slug: "kahve", primary_hostname: "kahveduragi.com" },
  pack: {
    id: "pack_0123456789abcdef",
    name: "Orta",
    credits: 2500,
    amount: 49_900,
    currency: "TRY",
  },
  status: "pending",
  method: null,
  reference: null,
  requested_at: "2026-11-24T09:00:00.000Z",
  decided_at: null,
}

/** The control plane, its cancel answering `closed` once the owner is proven. */
const refusingCancel =
  (closed: Answer) =>
  (call: Sent): Answer =>
    call.path === "/admin/cp/ai/orders/aico_1/cancel" && call.headers[STEP_UP_HEADER]
      ? closed
      : controlPlane(call)

function controlPlane(call: Sent): Answer {
  if (call.path.startsWith("/admin/cp/ai/orders?")) {
    return { status: 200, body: { orders: [ORDER], count: 1, limit: 50, offset: 0 } }
  }
  if (call.path.startsWith("/admin/cp/ai/orders/aico_1/")) {
    if (!call.headers[STEP_UP_HEADER]) {
      return refusal(428, "cp.step_up_required")
    }
    const status = call.path.endsWith("/paid") ? "paid" : "cancelled"
    return { status: 200, body: { applied: true, order: { ...ORDER, status } } }
  }
  if (call.path === "/admin/cp/me/step-up") {
    return { status: 200, body: PROOF }
  }
  return { status: 200, body: {} }
}

const page = () =>
  renderAs(
    <>
      <OrdersPage />
      <StepUpHost />
      <Toaster />
    </>,
    "owner"
  )

async function proveWithCode() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

describe("the AI credit requests (adr/0085 K11)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.search = { status: "pending", page: 1 }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists a pending request with its shop, credits and amount", async () => {
    const sent = stubApi(controlPlane)
    page()

    expect(await screen.findByText("Kahve Durağı")).toBeInTheDocument()
    expect(screen.getByText("kahveduragi.com")).toBeInTheDocument()
    expect(screen.getByText("2.500")).toBeInTheDocument()
    expect(screen.getByText(/499,00/)).toBeInTheDocument()
    expect(sent[0]?.path).toContain("status=pending")
    // The request names its shop: the shops' list is not read (P3d)
    expect(sent.filter((call) => call.path.startsWith("/admin/cp/tenants"))).toEqual([])
  })

  it.each([
    ["null (a shop no longer listed)", { tenant: null }],
    ["absent (a control plane before P3d)", { tenant: undefined }],
  ])("shows the shop by its id when its name is %s", async (_case, shop) => {
    stubApi((call) =>
      call.path.startsWith("/admin/cp/ai/orders?")
        ? { status: 200, body: { orders: [{ ...ORDER, ...shop }], count: 1, limit: 50, offset: 0 } }
        : controlPlane(call)
    )
    page()

    expect(await screen.findByRole("link", { name: "ten_kahve" })).toBeInTheDocument()
    expect(screen.queryByText("kahveduragi.com")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Ödendi olarak işaretle" }))
    const form = await screen.findByRole("dialog", { name: "Ödendi olarak işaretle" })
    expect(form).toHaveTextContent("ten_kahve mağazasına 2.500 kredi yüklenecek")
  })

  it("falls back to the slug when the shop has no primary address", async () => {
    stubApi((call) =>
      call.path.startsWith("/admin/cp/ai/orders?")
        ? {
            status: 200,
            body: {
              orders: [{ ...ORDER, tenant: { ...ORDER.tenant, primary_hostname: null } }],
              count: 1,
              limit: 50,
              offset: 0,
            },
          }
        : controlPlane(call)
    )
    page()

    expect(await screen.findByText("kahve")).toBeInTheDocument()
  })

  it("asks before marking paid, naming the shop and the credits, then sends one request", async () => {
    const sent = stubApi(controlPlane)
    page()

    await screen.findByText("Kahve Durağı")
    await userEvent.click(screen.getByRole("button", { name: "Ödendi olarak işaretle" }))
    const form = await screen.findByRole("dialog", { name: "Ödendi olarak işaretle" })
    expect(form).toHaveTextContent("Kahve Durağı mağazasına 2.500 kredi yüklenecek")
    // Opening the dialog sends nothing
    expect(sent.filter((call) => call.path.endsWith("/paid"))).toEqual([])
    await userEvent.type(within(form).getByLabelText("Dekont / referans"), "EFT 991")
    const submit = within(form).getByRole("button", { name: "Ödendi, krediyi yükle" })
    await userEvent.dblClick(submit)
    await proveWithCode()

    await waitFor(() => {
      const paid = sent.filter((call) => call.path === "/admin/cp/ai/orders/aico_1/paid")
      // The first one without a proof (428), then exactly one with it
      expect(paid.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
      expect(paid[1]?.body).toEqual({ method: "bank_transfer", reference: "EFT 991" })
    })
  })

  it("cancels a request after a confirmation that names it", async () => {
    const sent = stubApi(controlPlane)
    page()

    await screen.findByText("Kahve Durağı")
    await userEvent.click(screen.getByRole("button", { name: "İptal et" }))
    const ask = await screen.findByRole("alertdialog")
    expect(ask).toHaveTextContent("Kahve Durağı mağazasının Orta talebi")
    await userEvent.click(within(ask).getByRole("button", { name: "Talebi iptal et" }))
    await proveWithCode()

    await waitFor(() => {
      const cancel = sent.filter((call) => call.path === "/admin/cp/ai/orders/aico_1/cancel")
      expect(cancel.at(-1)?.headers[STEP_UP_HEADER]).toBe("proof-1")
      expect(cancel.at(-1)?.body).toEqual({})
    })
    // Said after the confirmation has closed
    expect(await screen.findByText("Talep iptal edildi.")).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("says why a cancel was refused once the confirmation has closed", async () => {
    stubApi(refusingCancel(refusal(409, "cp.ai_credit_order_closed", "conflict")))
    page()

    await screen.findByText("Kahve Durağı")
    await userEvent.click(screen.getByRole("button", { name: "İptal et" }))
    const ask = await screen.findByRole("alertdialog")
    await userEvent.click(within(ask).getByRole("button", { name: "Talebi iptal et" }))
    await proveWithCode()

    expect(
      await screen.findByText("Bu talep artık beklemiyor: ödenmiş ya da iptal edilmiş.")
    ).toBeInTheDocument()
  })
})
