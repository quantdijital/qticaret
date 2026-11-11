import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { StepUpHost } from "@/components/layout/step-up-host"
import type { Charge, PaymentList, SubscriptionDetail } from "@/features/billing/api"
import { SubscriptionTab } from "@/features/billing/components/subscription-tab"
import { PaymentsPage } from "@/features/billing/pages/payments-page"
import { STEP_UP_HEADER, forgetStepUp } from "@/lib/step-up"
import { refusal, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { renderAs } from "@/test/member"
import { routerState } from "@/test/router-mock"

vi.mock("@tanstack/react-router", () => import("@/test/router-mock"))

const BASE = "/admin/cp/tenants/ten_mylarte"
const PROOF = {
  step_up: { token: "proof-1", expires_at: new Date(Date.now() + 300_000).toISOString() },
}

const charge = (changes: Partial<Charge> = {}): Charge => ({
  id: "chg_aralik",
  period: "monthly",
  period_start: "2026-12-01",
  period_end: "2027-01-01",
  amount: 149_000,
  list_amount: 149_000,
  currency_code: "TRY",
  due_on: "2026-12-01",
  status: "open",
  standing: "overdue",
  grace_ends_on: "2026-12-08",
  paid_on: null,
  method: null,
  reference: null,
  settled_by: null,
  settled_at: null,
  settle_reason: null,
  amount_reason: null,
  invoice_number: null,
  ...changes,
})

const DETAIL: SubscriptionDetail = {
  subscription: {
    id: "sub_1",
    tenant_id: "ten_mylarte",
    package: { id: "pkg_pro", code: "profesyonel", name: "Profesyonel" },
    price: 149_000,
    period: "monthly",
    started_on: "2026-11-01",
    trial_ends_on: null,
    current_period_start: "2026-12-01",
    current_period_end: "2027-01-01",
    grace_days: 7,
    grace_days_override: null,
    grace_override_reason: null,
    grace_days_effective: 7,
    status: "restricted",
  },
  charges: [
    charge(),
    charge({
      id: "chg_kasim",
      period_start: "2026-11-01",
      period_end: "2026-12-01",
      due_on: "2026-11-01",
      status: "paid",
      standing: null,
      paid_on: "2026-11-03",
      method: "bank_transfer",
      reference: "EFT 0042",
      settled_by: "Ayşe Yılmaz",
    }),
  ],
  reminders: [
    {
      id: "rem_1",
      charge_id: "chg_aralik",
      kind: "restricted",
      outcome: "sent",
      error_code: null,
      sent_at: "2026-12-09T06:05:00.000Z",
      created_at: "2026-12-09T06:05:00.000Z",
    },
    {
      id: "rem_2",
      charge_id: "chg_aralik",
      kind: "due",
      outcome: "skipped",
      error_code: "billing.no_contact",
      sent_at: null,
      created_at: "2026-12-01T06:05:00.000Z",
    },
  ],
  today: "2026-12-10",
  invoicing: "none",
}

function controlPlane(answer: Answer | null = null) {
  return (call: Sent): Answer => {
    if (call.path === `${BASE}/subscription` && call.method === "GET") {
      return { status: 200, body: DETAIL }
    }
    if (call.path.startsWith(`${BASE}/charges/`) || call.path === `${BASE}/subscription`) {
      if (!call.headers[STEP_UP_HEADER]) {
        return refusal(428, "cp.step_up_required")
      }
      return answer ?? { status: 200, body: {} }
    }
    if (call.path === "/admin/cp/me/step-up") {
      return { status: 200, body: PROOF }
    }
    return { status: 200, body: {} }
  }
}

const tab = (role: Parameters<typeof renderAs>[1]) =>
  renderAs(
    <>
      <SubscriptionTab tenantId="ten_mylarte" />
      <StepUpHost />
    </>,
    role
  )

async function proveWithCode() {
  await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
  await userEvent.click(screen.getByRole("button", { name: "Doğrula" }))
}

describe("a shop's Abonelik tab (adr/0061 §7, Ek C16)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.search = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the subscription, its charges and the reminders sent, never to whom", async () => {
    stubApi(controlPlane())
    tab("readonly")

    expect(await screen.findByText("Kısıtlı")).toBeInTheDocument()
    expect(screen.getByText("Profesyonel")).toBeInTheDocument()
    expect(screen.getByText("7 gün (paketin)")).toBeInTheDocument()
    expect(screen.getByText("Kapalı (şirket kurulunca açılacak)")).toBeInTheDocument()
    expect(screen.getByText("Ek süre doldu")).toBeInTheDocument()
    expect(screen.getAllByText("Ödendi").length).toBeGreaterThan(0)
    expect(screen.getByText("Kısıtlama bildirimi")).toBeInTheDocument()
    expect(
      screen.getByText("Gönderilmedi · faturalama ya da sahip yetkilisi yok")
    ).toBeInTheDocument()
    // Reading only: no grace change, no actions in a charge's window
    expect(screen.queryByRole("button", { name: "Ek süreyi değiştir" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /^1 Ara 2026/ }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByRole("button", { name: "Ödendi" })).toBeNull()
  })

  it("lets finance mark a charge paid behind the step-up, with day, method and reference", async () => {
    const sent = stubApi(controlPlane())
    tab("finance")

    await userEvent.click(await screen.findByRole("button", { name: /^1 Ara 2026/ }))
    const facts = await screen.findByRole("dialog")
    // Voiding is the owner's alone
    expect(within(facts).queryByRole("button", { name: "Kaydı iptal et" })).toBeNull()
    await userEvent.click(within(facts).getByRole("button", { name: "Ödendi" }))
    const form = await screen.findByRole("dialog", { name: "Ödendi olarak işaretle" })
    await userEvent.click(within(form).getByLabelText("Kart (elle)"))
    await userEvent.type(within(form).getByLabelText("Dekont / referans"), "POS 7781")
    await userEvent.click(within(form).getByRole("button", { name: "Ödendi olarak işaretle" }))
    await proveWithCode()

    await waitFor(() => {
      const paid = sent.filter((call) => call.path === `${BASE}/charges/chg_aralik/pay`)
      expect(paid.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
      expect(paid[1]?.body).toEqual({
        paid_on: "2026-12-10",
        method: "card_manual",
        reference: "POS 7781",
      })
    })
  })

  it("corrects an amount in lira, sent as kuruş with the reason; says a refusal", async () => {
    const sent = stubApi(controlPlane(refusal(409, "cp.charge_not_open", "conflict")))
    tab("owner")

    await userEvent.click(await screen.findByRole("button", { name: /^1 Ara 2026/ }))
    const facts = await screen.findByRole("dialog")
    expect(within(facts).getByRole("button", { name: "Kaydı iptal et" })).toBeInTheDocument()
    await userEvent.click(within(facts).getByRole("button", { name: "Tutarı düzelt" }))
    const form = await screen.findByRole("dialog", { name: "Tutarı düzelt" })
    const amount = within(form).getByLabelText("Yeni tutar")
    await userEvent.clear(amount)
    await userEvent.type(amount, "1.200,50")
    const submit = within(form).getByRole("button", { name: "Tutarı kaydet" })
    expect(submit).toBeDisabled()
    await userEvent.type(within(form).getByLabelText("Gerekçe"), "Sözleşmedeki indirim")
    await userEvent.click(submit)
    await proveWithCode()

    expect(await within(form).findByRole("alert")).toHaveTextContent(
      "Bu ödeme kaydı artık açık değil"
    )
    const corrected = sent.filter((call) => call.path === `${BASE}/charges/chg_aralik/amount`)
    expect(corrected.at(-1)?.body).toEqual({ amount: 120_050, reason: "Sözleşmedeki indirim" })
  })

  it("never offers a correction to nothing, and says a free charge was waived (review M2)", async () => {
    stubApi((call) =>
      call.path === `${BASE}/subscription`
        ? {
            status: 200,
            body: {
              ...DETAIL,
              charges: [
                ...DETAIL.charges,
                charge({
                  id: "chg_ucretsiz",
                  period_start: "2027-01-01",
                  period_end: "2027-02-01",
                  due_on: "2027-01-01",
                  amount: 0,
                  list_amount: 0,
                  status: "waived",
                  standing: null,
                  settle_reason: "billing.zero_amount",
                }),
              ],
            },
          }
        : controlPlane()(call)
    )
    tab("finance")

    await userEvent.click(await screen.findByRole("button", { name: /^1 Oca 2027/ }))
    const free = await screen.findByRole("dialog")
    expect(
      within(free).getByText("Tutar sıfır: kayıt açılırken kendiliğinden bağışlandı.")
    ).toBeInTheDocument()
    expect(within(free).queryByRole("button", { name: "Tutarı düzelt" })).toBeNull()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })

    await userEvent.click(screen.getByRole("button", { name: /^1 Ara 2026/ }))
    const facts = await screen.findByRole("dialog")
    await userEvent.click(within(facts).getByRole("button", { name: "Tutarı düzelt" }))
    const form = await screen.findByRole("dialog", { name: "Tutarı düzelt" })
    const amount = within(form).getByLabelText("Yeni tutar")
    await userEvent.clear(amount)
    await userEvent.type(amount, "0")
    await userEvent.type(within(form).getByLabelText("Gerekçe"), "Ücretsiz ay")
    expect(within(form).getByRole("button", { name: "Tutarı kaydet" })).toBeDisabled()
    expect(within(form).getByText(/Borcu tamamen kaldırmak için Bağışla/)).toBeInTheDocument()
  })

  it("gives the shop its own grace days with a reason", async () => {
    const sent = stubApi(controlPlane())
    tab("finance")

    await userEvent.click(await screen.findByRole("button", { name: "Ek süreyi değiştir" }))
    const form = await screen.findByRole("dialog", { name: "Ek süre" })
    await userEvent.click(within(form).getByLabelText("Bu mağazaya özel ek süre"))
    const days = within(form).getByLabelText("Ek süre")
    await userEvent.clear(days)
    await userEvent.type(days, "21")
    await userEvent.type(within(form).getByLabelText("Gerekçe"), "Bayram tatili")
    await userEvent.click(within(form).getByRole("button", { name: "Kaydet" }))
    await proveWithCode()

    await waitFor(() => {
      const grace = sent.filter(
        (call) => call.path === `${BASE}/subscription` && call.method === "POST"
      )
      expect(grace.at(-1)?.body).toEqual({ grace_days: 21, reason: "Bayram tatili" })
    })
  })
})

const LIST: PaymentList = {
  payments: [
    {
      id: "chg_aralik",
      tenant: { id: "ten_mylarte", name: "My L'arte", slug: "mylarte", status: "restricted" },
      period_start: "2026-12-01",
      period_end: "2027-01-01",
      amount: 149_000,
      currency_code: "TRY",
      due_on: "2026-12-01",
      status: "open",
      standing: "overdue",
      grace_ends_on: "2026-12-08",
      paid_on: null,
      method: null,
      settled_by: null,
    },
  ],
  count: 1,
  total: 149_000,
  counts: { upcoming: 3, overdue: 1, paid: 12 },
  today: "2026-12-10",
  search_truncated: false,
}

function paymentsPlane(call: Sent): Answer {
  if (call.path.startsWith("/admin/cp/payments")) {
    return { status: 200, body: LIST }
  }
  if (call.path === "/admin/cp/billing-settings" && call.method === "GET") {
    return {
      status: 200,
      body: { payment_instruction: null, updated_at: null, updated_by: null },
    }
  }
  if (call.path === "/admin/cp/billing-settings") {
    return call.headers[STEP_UP_HEADER]
      ? { status: 200, body: { payment_instruction: "IBAN", updated_at: null, updated_by: null } }
      : refusal(428, "cp.step_up_required")
  }
  if (call.path === "/admin/cp/me/step-up") {
    return { status: 200, body: PROOF }
  }
  return { status: 200, body: {} }
}

describe("Ödemeler (adr/0061 §7, Ek C16)", () => {
  beforeEach(() => {
    forgetStepUp()
    routerState.search = { view: "overdue", q: "", page: 1 }
    routerState.navigate.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lists a view with each tab's count and its total; a row opens the shop's Abonelik tab", async () => {
    const sent = stubApi(paymentsPlane)
    renderAs(<PaymentsPage />, "readonly")

    expect(await screen.findByText("My L'arte")).toBeInTheDocument()
    expect(screen.getByText(/^1 kayıt · toplam .*1\.490,00/)).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Ödenen.*12/ })).toBeInTheDocument()
    expect(screen.getByText("Ek süre doldu")).toBeInTheDocument()
    expect(screen.getByText("Henüz ödeme talimatı yazılmadı.")).toBeInTheDocument()
    // Only the owner edits the instruction
    expect(screen.queryByRole("button", { name: "Düzenle" })).toBeNull()
    expect(sent.some((call) => call.path.includes("view=overdue"))).toBe(true)
    await userEvent.click(screen.getByRole("cell", { name: /^.?1\.490,00.?$/ }))
    expect(routerState.navigate).toHaveBeenCalledWith({
      to: "/tenants/$id",
      params: { id: "ten_mylarte" },
      search: { part: "subscription" },
    })
  })

  it("says when a search matched more shops than it looked at (review)", async () => {
    stubApi((call) =>
      call.path.startsWith("/admin/cp/payments")
        ? { status: 200, body: { ...LIST, search_truncated: true } }
        : paymentsPlane(call)
    )
    renderAs(<PaymentsPage />, "finance")
    expect(await screen.findByText(/Aramaya çok fazla mağaza uydu/)).toBeInTheDocument()
  })

  it("lets the owner write the payment instruction behind the step-up", async () => {
    const sent = stubApi(paymentsPlane)
    renderAs(
      <>
        <PaymentsPage />
        <StepUpHost />
      </>,
      "owner"
    )

    await userEvent.click(await screen.findByRole("button", { name: "Düzenle" }))
    const form = await screen.findByRole("dialog", { name: "Ödeme talimatı" })
    await userEvent.type(within(form).getByLabelText("Talimat"), "IBAN: TR12")
    await userEvent.click(within(form).getByRole("button", { name: "Kaydet" }))
    await proveWithCode()

    await waitFor(() => {
      const saved = sent.filter(
        (call) => call.path === "/admin/cp/billing-settings" && call.method === "POST"
      )
      expect(saved.map((call) => call.headers[STEP_UP_HEADER])).toEqual([undefined, "proof-1"])
      expect(saved[1]?.body).toEqual({ payment_instruction: "IBAN: TR12" })
    })
  })
})
