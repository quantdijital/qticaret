import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
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

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest("li")
  if (!row) {
    throw new Error(`no row for ${name}`)
  }
  return within(row)
}

/** A fact of the package card by its label: its value and hint. */
const factOf = (label: string) => {
  const fact = screen.getByText(label).parentElement
  if (!fact) {
    throw new Error(`no fact ${label}`)
  }
  return within(fact)
}

const LATE = {
  status: "past_due" as const,
  due_on: "2026-11-15",
  grace_ends_on: "2026-12-08",
  amount: 149_000,
  currency: "TRY" as const,
}

describe("SubscriptionPage (adr/0061 §5.6, Ek C14, C16)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    // An Istanbul day five days before the fixture's due day; only Date is faked
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-26T09:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("leads with the package, one status and the next payment", async () => {
    fetchMock.mockResolvedValue({ plan: planOf() })
    renderPage()

    expect(await screen.findByText("Standart")).toBeInTheDocument()
    expect(screen.getByText("Etkin")).toBeInTheDocument()
    expect(screen.getByText("Aboneliğiniz güncel.")).toBeInTheDocument()
    expect(factOf("Sonraki ödeme").getByText("1 Ara 2026")).toBeInTheDocument()
    expect(factOf("Tutar").getByText(/1\.499,00/)).toBeInTheDocument()
    // The month as words, not `2026-11`
    expect(factOf("Kullanım dönemi").getByText("Kasım 2026")).toBeInTheDocument()
    expect(screen.queryByText("2026-11")).toBeNull()
    expect(
      screen.getByText("Ödeme bilgileri, ödeme günü yaklaştığında burada görünür.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Paketinizi yükseltmek ya da değiştirmek için bizimle iletişime geçin.")
    ).toBeInTheDocument()
    // Read only, and nothing to copy without an instruction
    expect(screen.queryByRole("button")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/admin/plan")
  })

  it("groups the limits into the shop's totals and this month, as meters", async () => {
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

    const totals = await screen.findByRole("list", { name: "Mağaza geneli" })
    const month = screen.getByRole("list", { name: "Bu ay · Kasım 2026" })
    expect(within(totals).getAllByRole("listitem")).toHaveLength(3)
    // Custom domains are not applied yet: not listed
    expect(within(month).getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByText("Özel alan adları")).toBeNull()

    expect(rowOf("Ürünler").getByText("Limitte")).toBeInTheDocument()
    expect(rowOf("Ürünler").getByText("500 / 500")).toBeInTheDocument()
    expect(rowOf("Ürünler").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    // Storage in GB, how much is left in MB
    expect(rowOf("Depolama").getByText("1,7 GB / 2 GB")).toBeInTheDocument()
    expect(rowOf("Depolama").getByText("Limite yaklaştı")).toBeInTheDocument()
    expect(rowOf("Depolama").getByText("348 MB kaldı")).toBeInTheDocument()
    // The month's orders past their limit: a warning, never a refusal
    expect(rowOf("Bu ayki siparişler").getByText("Limit aşıldı")).toBeInTheDocument()
    expect(
      rowOf("Bu ayki siparişler").getByText("20 fazla · Siparişler hiçbir zaman durdurulmaz")
    ).toBeInTheDocument()
    expect(rowOf("Ekip").getByText("1 kaldı · 1 bekleyen davet dahil")).toBeInTheDocument()
    expect(rowOf("Bu ayki içerik taslakları").queryByText("Limite yaklaştı")).toBeNull()
    expect(rowOf("Bu ayki içerik taslakları").getByText("93 kaldı")).toBeInTheDocument()
  })

  it("shows a trial's end and its first payment", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({
        billing: {
          status: "trialing",
          due_on: "2026-12-10",
          grace_ends_on: null,
          amount: 99_900,
          currency: "TRY",
        },
      }),
    })
    renderPage()

    expect(await screen.findByText("Deneme süresinde")).toBeInTheDocument()
    expect(factOf("Deneme bitişi").getByText("10 Ara 2026")).toBeInTheDocument()
    expect(factOf("İlk ödeme tutarı").getByText(/999,00/)).toBeInTheDocument()
    expect(screen.queryByText("Sonraki ödeme")).toBeNull()
  })

  it("says a payment is near in its last days", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({
        billing: {
          status: "active",
          due_on: "2026-11-28",
          grace_ends_on: null,
          amount: 149_900,
          currency: "TRY",
        },
      }),
    })
    renderPage()
    expect(await screen.findByText("Ödeme yaklaşıyor")).toBeInTheDocument()
  })

  it("shows a late payment with its grace day, how to pay, and copies it", async () => {
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
    expect(screen.getByText("Ödeme gecikti")).toBeInTheDocument()
    expect(factOf("Geciken ödeme").getByText("15 Kas 2026")).toBeInTheDocument()
    expect(factOf("Tutar").getByText(/1\.490,00/)).toBeInTheDocument()
    expect(factOf("Ek süre bitişi").getByText("8 Ara 2026")).toBeInTheDocument()
    expect(screen.queryByText("Kullanım dönemi")).toBeNull()
    expect(screen.getByText(/IBAN: TR12 0006/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Kopyala" }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(instruction)
    })
  })

  it("leads with the restricted shop's state over its payment's", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({ status: "restricted", billing: { ...LATE, status: "restricted" } }),
    })
    renderPage()

    expect(await screen.findByText("Kısıtlı")).toBeInTheDocument()
    expect(screen.getByText(/panel salt okunur/)).toBeInTheDocument()
    expect(factOf("Ek süre bitişi").getByText("8 Ara 2026")).toBeInTheDocument()
  })

  it("says nothing is due when no payment is open", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({
        billing: {
          status: "active",
          due_on: null,
          grace_ends_on: null,
          amount: null,
          currency: "TRY",
        },
      }),
    })
    renderPage()

    expect(await screen.findByText("Bekleyen ödeme yok")).toBeInTheDocument()
    expect(factOf("Tutar").getByText("—")).toBeInTheDocument()
  })

  it("names the package from its code when an older document has no name", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({ package_code: "kurumsal", package_name: null }),
    })
    renderPage()
    expect(await screen.findByText("Kurumsal")).toBeInTheDocument()
  })

  it("says a shop without a plan has no limits, and shows its use", async () => {
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

    expect(
      await screen.findByText(
        "Bu mağazada paket limiti yok: ürün, ekip, depolama ve içerik taslakları sınırsızdır."
      )
    ).toBeInTheDocument()
    expect(rowOf("Ürünler").getByText("120 · sınırsız")).toBeInTheDocument()
    expect(rowOf("Depolama").getByText("380 MB · sınırsız")).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByText("Paketiniz")).toBeNull()
    expect(screen.queryByText("Nasıl ödenir")).toBeNull()
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
