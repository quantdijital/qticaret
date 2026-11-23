import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BillingSummary, PaymentRecord, PlanSummary } from "@/features/settings/api/plan"
import { planOf } from "@/features/settings/plan.fixtures"
import { SubscriptionPage } from "./subscription-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SubscriptionPage />
    </QueryClientProvider>
  )
}

const packageCard = () => within(screen.getByRole("region", { name: "Paket" }))

const billingOf = (changes: Partial<BillingSummary>): BillingSummary => ({
  status: "active",
  due_on: "2026-12-01",
  grace_ends_on: null,
  amount: 149_000,
  currency: "TRY",
  period: "monthly",
  price: 149_000,
  trial_started_on: null,
  trial_ends_on: null,
  ...changes,
})

const record = (changes: Partial<PaymentRecord>): PaymentRecord => ({
  id: "chg_01",
  period: "monthly",
  period_start: "2026-10-01",
  period_end: "2026-11-01",
  due_on: "2026-10-01",
  amount: 149_000,
  currency: "TRY",
  status: "paid",
  paid_on: "2026-10-02",
  invoice_number: null,
  invoice_url: null,
  ...changes,
})

/** The backend: the plan, and the payments (or a failure) for `/admin/plan/payments`. */
function serve(plan: PlanSummary, payments: unknown) {
  fetchMock.mockImplementation((path: string) => {
    if (path === "/admin/plan/payments") {
      return payments instanceof Error ? Promise.reject(payments) : Promise.resolve(payments)
    }
    return Promise.resolve({ plan })
  })
}

async function paymentsCard() {
  const section = (await screen.findByRole("heading", { name: "Ödemeler" })).closest("section")
  if (!section) {
    throw new Error("no payments card")
  }
  return within(section)
}

describe("SubscriptionPage: terms and payments (adr/0061 Ek C20)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // Istanbul's 26 Nov 2026; only Date is faked
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-26T09:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("writes the amount per period and the package's price", async () => {
    serve(planOf({ billing: billingOf({}) }), { payments: { state: "ok", records: [] } })
    renderPage()

    await screen.findByText("Standart")
    expect(packageCard().getByText("/ ay")).toBeInTheDocument()
    expect(packageCard().getByText("Paket ücreti")).toBeInTheDocument()
    expect(packageCard().getByText(/1\.490,00\s*\/ ay/)).toBeInTheDocument()
  })

  it("writes a yearly package's amount per year", async () => {
    serve(planOf({ billing: billingOf({ period: "yearly", price: 1_490_000 }) }), {
      payments: { state: "ok", records: [] },
    })
    renderPage()

    await screen.findByText("Standart")
    expect(packageCard().getByText("/ yıl")).toBeInTheDocument()
    expect(packageCard().getByText(/14\.900,00\s*\/ yıl/)).toBeInTheDocument()
  })

  it("shows a trial's ring as days used of its whole", async () => {
    serve(
      planOf({
        billing: billingOf({
          status: "trialing",
          due_on: "2026-12-01",
          trial_started_on: "2026-11-17",
          trial_ends_on: "2026-12-01",
        }),
      }),
      { payments: { state: "ok", records: [] } }
    )
    renderPage()

    await screen.findByText("Standart")
    expect(packageCard().getByRole("img", { name: "Deneme: 9 / 14 gün" })).toBeInTheDocument()
    expect(packageCard().getByText("/14")).toBeInTheDocument()
    // The countdown chip still says what is left
    expect(packageCard().getByText("5 gün kaldı")).toBeInTheDocument()
  })

  it("keeps an older document's look: no period, no price, the ring counts down", async () => {
    const older = billingOf({ status: "trialing" })
    for (const key of ["period", "price", "trial_started_on", "trial_ends_on"] as const) {
      Reflect.deleteProperty(older, key)
    }
    serve(planOf({ billing: older }), { payments: { state: "ok", records: [] } })
    renderPage()

    await screen.findByText("Standart")
    expect(packageCard().queryByText("/ ay")).toBeNull()
    expect(packageCard().queryByText("Paket ücreti")).toBeNull()
    expect(packageCard().getByRole("img", { name: "5 gün kaldı" })).toBeInTheDocument()
  })

  it("lists the payments latest first: period, day, amount, status and the invoice", async () => {
    serve(planOf({ billing: billingOf({}) }), {
      payments: {
        state: "ok",
        records: [
          record({
            id: "chg_03",
            period_start: "2026-11-01",
            period_end: "2026-12-01",
            due_on: "2026-11-01",
            status: "open",
            paid_on: null,
          }),
          record({
            id: "chg_02",
            invoice_number: "QTC2026000002",
            invoice_url: "https://fatura.example.com/QTC2026000002.pdf",
          }),
          record({
            id: "chg_01",
            period_start: "2026-09-01",
            period_end: "2026-10-01",
            due_on: "2026-12-30",
            status: "waived",
            paid_on: null,
          }),
        ],
      },
    })
    renderPage()

    const card = await paymentsCard()
    const rows = await card.findAllByRole("row")
    // The header, then one row a payment
    expect(rows).toHaveLength(4)
    const [, late, paid, waived] = rows.map((row) => within(row))
    expect(late?.getByText("Kasım 2026")).toBeInTheDocument()
    expect(late?.getByText("Gecikti")).toBeInTheDocument()
    expect(paid?.getByText("Ekim 2026")).toBeInTheDocument()
    expect(paid?.getByText("Ödendi")).toBeInTheDocument()
    expect(paid?.getAllByText("2 Eki 2026").length).toBeGreaterThan(0)
    expect(paid?.getByText(/1\.490,00/)).toBeInTheDocument()
    const link = paid?.getByRole("link", { name: "Ekim 2026 faturası" })
    expect(link).toHaveAttribute("href", "https://fatura.example.com/QTC2026000002.pdf")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    expect(waived?.getByText("Bağışlandı")).toBeInTheDocument()
    expect(waived?.getByText("Fatura yok")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/plan/payments")
  })

  it("shows six payments, then all on ask; a yearly one by its first and last month", async () => {
    const records = Array.from({ length: 8 }, (_, index) =>
      record({ id: `chg_${String(index)}`, period: "yearly", period_end: "2027-10-01" })
    )
    serve(planOf({ billing: billingOf({}) }), { payments: { state: "ok", records } })
    renderPage()

    const card = await paymentsCard()
    expect(await card.findAllByRole("row")).toHaveLength(7)
    expect(card.getAllByText("Ekim 2026 – Eylül 2027")).toHaveLength(6)
    fireEvent.click(card.getByRole("button", { name: "Tümünü göster (8)" }))
    expect(card.getAllByRole("row")).toHaveLength(9)
    expect(card.queryByRole("button", { name: /Tümünü göster/ })).toBeNull()
  })

  it("says when there are no payments yet, and when they cannot be read now", async () => {
    serve(planOf({ billing: billingOf({}) }), { payments: { state: "ok", records: [] } })
    const first = renderPage()
    expect(await (await paymentsCard()).findByText("Henüz ödeme yok")).toBeInTheDocument()
    first.unmount()

    serve(planOf({ billing: billingOf({}) }), { payments: { state: "unavailable", records: [] } })
    const second = renderPage()
    expect(await (await paymentsCard()).findByText("Ödemeler şu an alınamadı")).toBeInTheDocument()
    second.unmount()

    // An older backend without the route: the same words, the page stands
    serve(planOf({ billing: billingOf({}) }), new Error("404"))
    renderPage()
    expect(await (await paymentsCard()).findByText("Ödemeler şu an alınamadı")).toBeInTheDocument()
    expect(screen.getByText("Standart")).toBeInTheDocument()
  })

  it("has no payments card for a shop without a control plane", async () => {
    serve(planOf({ managed: false, billing: null }), {
      payments: { state: "unmanaged", records: [] },
    })
    renderPage()

    expect(await screen.findByText("Paket limiti yok")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Ödemeler" })).toBeNull()
  })
})
