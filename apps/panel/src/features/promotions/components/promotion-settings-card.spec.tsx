import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { PromotionSettingsCard } from "./promotion-settings-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    hash,
  }: {
    children: ReactNode
    to: string
    search: { part: string }
    hash: string
  }) => <a href={`${to}?part=${search.part}#${hash}`}>{children}</a>,
}))

function renderCard(threshold: number | null) {
  fetchMock.mockResolvedValue({
    section: "promotions",
    values: { combine_codes: false, free_shipping_threshold: threshold },
    version: 1,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PromotionSettingsCard />
    </QueryClientProvider>
  )
}

// The owner, 2026-11-26: the threshold is edited under Kargo; here a line and a link
describe("PromotionSettingsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the threshold and links to the shipping card", async () => {
    renderCard(1500)
    expect(await screen.findByTestId("free-shipping-summary")).toHaveTextContent(
      /^Kargo bedava eşiği: ₺1\.500,00$/
    )
    expect(screen.getByRole("link", { name: "Kargo ayarlarında değiştir" })).toHaveAttribute(
      "href",
      "/settings/shipping?part=options#free-shipping"
    )
    expect(screen.queryByLabelText("En az sepet tutarı")).not.toBeInTheDocument()
    expect(screen.getByRole("switch")).toHaveAccessibleName(/Bir sepette birden fazla kod/)
  })

  it("says Kapalı without a threshold", async () => {
    renderCard(null)
    expect(await screen.findByTestId("free-shipping-summary")).toHaveTextContent(
      "Kargo bedava eşiği: Kapalı"
    )
  })
})
