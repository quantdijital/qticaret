import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { planOf } from "@/features/settings/plan.fixtures"
import { LimitNotice } from "./limit-notice"

const fetchMock = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ settings: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "settings" && staff.settings,
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

function renderNotice(limit: Parameters<typeof LimitNotice>[0]["limit"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <p>Sayfa</p>
      <LimitNotice limit={limit} />
    </QueryClientProvider>
  )
}

describe("LimitNotice (adr/0061 Ek C14)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    staff.settings = true
  })

  it("says nothing below 80 %", async () => {
    fetchMock.mockResolvedValue({ plan: planOf() })
    renderNotice("products")
    await screen.findByText("Sayfa")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("warns near the product limit and links to the subscription", async () => {
    fetchMock.mockResolvedValue({ plan: planOf({}, { products: { used: 400 } }) })
    renderNotice("products")

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ürün limitinize yaklaştınız (400/500)."
    )
    expect(screen.getByRole("link", { name: "Aboneliği gör" })).toHaveAttribute(
      "href",
      "/settings/subscription"
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/plan")
  })

  it("says what stops at a blocking limit, and that what exists stays", async () => {
    fetchMock.mockResolvedValue({ plan: planOf({}, { staff: { used: 3, max: 3 } }) })
    renderNotice("staff")
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Ekip limitinize ulaştınız (3/3, bekleyen davetler dahil). Yeni davet gönderilemez."
    )
  })

  it("tells the month's orders past their limit keep coming", async () => {
    fetchMock.mockResolvedValue({ plan: planOf({}, { orders_per_month: { used: 310 } }) })
    renderNotice("orders_per_month")
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Bu ayki sipariş limitinizi aştınız (310/300). Siparişleriniz alınmaya devam eder"
    )
  })

  it("asks nothing for a role without settings, and shows nothing without a plan", async () => {
    staff.settings = false
    renderNotice("products")
    await screen.findByText("Sayfa")
    expect(fetchMock).not.toHaveBeenCalled()

    staff.settings = true
    fetchMock.mockResolvedValue({ media: [] })
    renderNotice("storage_mb")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByRole("status")).toBeNull()
  })
})
