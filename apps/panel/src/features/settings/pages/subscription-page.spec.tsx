import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
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

describe("SubscriptionPage (adr/0061 §5.6, Ek C14)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the package, each limit's use, and the payment, read only", async () => {
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
    // Custom domains are not applied yet: not listed
    expect(within(list).getAllByRole("listitem")).toHaveLength(5)
    expect(rowOf("Ürünler").getByText("Limitte")).toBeInTheDocument()
    expect(rowOf("Ürünler").getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    expect(rowOf("Depolama").getByText("Limite yaklaştı")).toBeInTheDocument()
    expect(rowOf("Depolama").getByText("1.700 MB / 2.048 MB")).toBeInTheDocument()
    // The month's orders past their limit: a warning, never a refusal
    expect(rowOf("Bu ayki siparişler").getByText("Limit aşıldı")).toBeInTheDocument()
    expect(rowOf("Bu ayki siparişler").getByText("Uyarı, engellenmez")).toBeInTheDocument()
    expect(rowOf("Ekip").getByText("1 bekleyen davet dahil")).toBeInTheDocument()

    expect(screen.getByText("Standart")).toBeInTheDocument()
    expect(screen.getByText("Etkin")).toBeInTheDocument()
    expect(screen.getByText("Güncel")).toBeInTheDocument()
    expect(screen.getByText("1 Ara 2026")).toBeInTheDocument()
    expect(screen.getByText(/1\.499,00/)).toBeInTheDocument()
    expect(
      screen.getByText("Ödeme talimatı, ödeme günü yaklaştığında burada görünür.")
    ).toBeInTheDocument()
    // Read only: nothing to press
    expect(screen.queryByRole("button")).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith("/admin/plan")
  })

  it("shows the payment instruction the plan document carries", async () => {
    fetchMock.mockResolvedValue({
      plan: planOf({ payment_instruction: "Havale açıklamasına mağaza kodunuzu yazın." }),
    })
    renderPage()
    expect(
      await screen.findByText("Havale açıklamasına mağaza kodunuzu yazın.")
    ).toBeInTheDocument()
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
    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.queryByText("Ödeme")).toBeNull()
  })
})
