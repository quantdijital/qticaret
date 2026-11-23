import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BillingSummary } from "@/features/settings/api/plan"
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

/** A usage tile by its limit's name. */
const tileOf = (name: string) => within(screen.getByRole("listitem", { name }))

const packageCard = () => within(screen.getByRole("region", { name: "Paket" }))

const billingOf = (changes: Partial<BillingSummary>): BillingSummary => ({
  status: "active",
  due_on: "2026-12-01",
  grace_ends_on: null,
  amount: 149_900,
  currency: "TRY",
  ...changes,
})

const LATE = billingOf({
  status: "past_due",
  due_on: "2026-11-15",
  grace_ends_on: "2026-12-08",
  amount: 149_000,
})

describe("SubscriptionPage (adr/0061 §5.6, Ek C14, C16)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // Istanbul's 26 Nov 2026, five days before the fixture's due day; only Date is faked
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-26T09:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("leads with the package, one status, the amount due, its day and a countdown", async () => {
    fetchMock.mockResolvedValue({ plan: planOf() })
    renderPage()

    await screen.findByText("Standart")
    const card = packageCard()
    expect(card.getByRole("heading", { name: "Standart" })).toBeInTheDocument()
    expect(card.getByText("Etkin")).toBeInTheDocument()
    expect(card.getByText("Sonraki ödeme")).toBeInTheDocument()
    expect(card.getByText(/1\.499,00/)).toBeInTheDocument()
    expect(card.getByText("1 Ara 2026")).toBeInTheDocument()
    expect(card.getByText("5 gün kaldı")).toBeInTheDocument()
    expect(card.getByRole("img", { name: "5 gün kaldı" })).toBeInTheDocument()
    // The month as words, not `2026-11`; what it means behind the (i)
    expect(card.getByText("Kasım 2026")).toBeInTheDocument()
    expect(screen.queryByText("2026-11")).toBeNull()
    expect(card.getByRole("button", { name: "Bilgi: Dönem" })).toBeInTheDocument()
    // The status's sentence is not on the card, only behind its (i) for a screen reader
    expect(card.getByRole("button", { name: "Bilgi: Etkin" })).toHaveAccessibleDescription(
      "Aboneliğiniz güncel."
    )
    // No instruction yet: an empty state, nothing to copy, the package change as one line
    expect(screen.getByText("Ödeme bilgisi yok")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kopyala" })).toBeNull()
    expect(screen.getByRole("button", { name: "Bilgi: Paket değişikliği" })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/plan")
  })

  it("shows each limit as a tile: use over limit, a bar coloured by threshold, monthly marked", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf(
        {},
        {
          products: { used: 500 },
          storage_mb: { used: 1700 },
          orders_per_month: { used: 320 },
        }
      ),
    })
    renderPage()

    const list = await screen.findByRole("list", { name: "Limitler ve kullanım" })
    // Custom domains are not applied yet: no tile
    expect(within(list).getAllByRole("listitem")).toHaveLength(5)
    expect(screen.queryByText("Özel alan adları")).toBeNull()

    expect(tileOf("Ürünler").getByText("Limitte")).toBeInTheDocument()
    expect(tileOf("Ürünler").getByText("500")).toBeInTheDocument()
    expect(tileOf("Ürünler").getByText("/ 500")).toBeInTheDocument()
    expect(tileOf("Ürünler").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    expect(tileOf("Ürünler").queryByText("Bu ay")).toBeNull()
    // Storage in GB, how much is left in MB
    expect(tileOf("Depolama").getByText("1,7 GB")).toBeInTheDocument()
    expect(tileOf("Depolama").getByText("/ 2 GB")).toBeInTheDocument()
    expect(tileOf("Depolama").getByText("Limite yaklaştı")).toBeInTheDocument()
    expect(tileOf("Depolama").getByText("348 MB kaldı")).toBeInTheDocument()
    // The month's orders past their limit: a warning, never a refusal (said behind the (i))
    const orders = tileOf("Siparişler")
    expect(orders.getByText("Bu ay")).toBeInTheDocument()
    expect(orders.getByText("Limit aşıldı")).toBeInTheDocument()
    expect(orders.getByText("20 fazla")).toBeInTheDocument()
    expect(orders.getByRole("button", { name: "Bilgi: Siparişler" })).toBeInTheDocument()
    expect(tileOf("Ekip").getByText("1 davet bekliyor")).toBeInTheDocument()
    expect(tileOf("İçerik taslakları").getByText("Bu ay")).toBeInTheDocument()
    expect(tileOf("İçerik taslakları").queryByText("Limite yaklaştı")).toBeNull()
    expect(tileOf("İçerik taslakları").getByText("93 kaldı")).toBeInTheDocument()
  })

  it("counts down a trial to its end and names the first payment", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({
        billing: billingOf({ status: "trialing", due_on: "2026-12-10", amount: 99_900 }),
      }),
    })
    renderPage()

    expect(await screen.findByText("Deneme süresinde")).toBeInTheDocument()
    const card = packageCard()
    expect(card.getByText("İlk ödeme")).toBeInTheDocument()
    expect(card.getByText(/999,00/)).toBeInTheDocument()
    expect(card.getByText("10 Ara 2026")).toBeInTheDocument()
    expect(card.getByRole("img", { name: "14 gün kaldı" })).toHaveTextContent("Deneme")
    expect(card.queryByText("Sonraki ödeme")).toBeNull()
  })

  it("turns amber in a payment's last days", async () => {
    fetchMock.mockResolvedValue({ plan: planOf({ billing: billingOf({ due_on: "2026-11-28" }) }) })
    renderPage()
    expect(await screen.findByText("Ödeme yaklaşıyor")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "2 gün kaldı" })).toBeInTheDocument()
  })

  it("says the due day is today", async () => {
    fetchMock.mockResolvedValue({ plan: planOf({ billing: billingOf({ due_on: "2026-11-26" }) }) })
    renderPage()
    expect(await screen.findByRole("img", { name: "Bugün" })).toBeInTheDocument()
  })

  it("counts a late payment's grace down, shows how to pay and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    const instruction = "Alıcı: Quant Dijital Yazılım\nIBAN: TR12 0006 4000 0011 2345 6789 01"
    fetchMock.mockResolvedValue({
      plan: planOf({
        package_code: "profesyonel-ag",
        package_name: "Profesyonel Ağ",
        billing: LATE,
        payment_instruction: instruction,
      }),
    })
    renderPage()

    expect(await screen.findByText("Profesyonel Ağ")).toBeInTheDocument()
    const card = packageCard()
    expect(card.getByText("Ödeme gecikti")).toBeInTheDocument()
    expect(card.getByText("Geciken ödeme")).toBeInTheDocument()
    expect(card.getByText(/1\.490,00/)).toBeInTheDocument()
    expect(card.getByText("15 Kas 2026")).toBeInTheDocument()
    expect(card.getByText("8 Ara 2026")).toBeInTheDocument()
    expect(card.getByRole("img", { name: "Ek süre: 12 gün" })).toBeInTheDocument()
    expect(screen.getByText(/IBAN: TR12 0006/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Kopyala" }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(instruction)
    })
  })

  it("leads with the restricted shop's state and counts the days overdue", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({
        status: "restricted",
        billing: { ...LATE, status: "restricted", grace_ends_on: "2026-11-22" },
      }),
    })
    renderPage()

    expect(await screen.findByText("Kısıtlı")).toBeInTheDocument()
    expect(screen.getByText(/panel salt okunur/)).toHaveClass("sr-only")
    expect(screen.getByRole("img", { name: "11 gün gecikti" })).toBeInTheDocument()
  })

  it("says nothing is due when no payment is open, without a ring", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({ billing: billingOf({ due_on: null, amount: null }) }),
    })
    renderPage()

    expect(await screen.findByText("Bekleyen ödeme yok")).toBeInTheDocument()
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("names the package from its code when an older document has no name", async () => {
    fetchMock.mockResolvedValue({ plan: planOf({ package_code: "kurumsal", package_name: null }) })
    renderPage()
    expect(await screen.findByText("Kurumsal")).toBeInTheDocument()
  })

  it("shows a shop without a control plane only its use, every tile unlimited", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf(
        { managed: false, package_code: null, billing: null },
        {
          products: { max: null },
          orders_per_month: { max: null },
          staff: { max: null, pending: 0 },
          storage_mb: { max: null },
          llm_credits_per_month: { max: null },
          custom_domains: { max: null },
        }
      ),
    })
    renderPage()

    expect(await screen.findByText("Paket limiti yok")).toBeInTheDocument()
    expect(screen.getAllByText("Sınırsız")).toHaveLength(5)
    expect(tileOf("Ürünler").getByText("120")).toBeInTheDocument()
    expect(tileOf("Depolama").getByText("380 MB")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByRole("region", { name: "Paket" })).toBeNull()
    expect(screen.queryByText("Ödeme bilgileri")).toBeNull()
  })

  it("shows the page's shape while it loads, and a retry when it fails", async () => {
    let fail: (error: Error) => void = () => undefined
    fetchMock.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject
      })
    )
    const { container } = renderPage()
    expect(container.querySelector("[aria-busy=true]")).not.toBeNull()
    expect(screen.getByText("Abonelik bilgileri yükleniyor")).toBeInTheDocument()

    fail(new Error("down"))
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByRole("button")).toBeInTheDocument()
  })
})
