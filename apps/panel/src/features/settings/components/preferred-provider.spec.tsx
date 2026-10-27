import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { PreferredProviderRow } from "./preferred-provider"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function renderRow(connected: ("paytr" | "iyzico")[], chosen: "paytr" | "iyzico" | null) {
  fetchMock.mockResolvedValue({
    section: "payments",
    values: { installments_enabled: true, max_installment: 0, card_provider: chosen },
    version: 1,
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ul>
        <PreferredProviderRow connected={connected} />
      </ul>
    </QueryClientProvider>
  )
}

describe("PreferredProviderRow", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("asks which card provider comes first once two are connected, showing the choice", async () => {
    renderRow(["paytr", "iyzico"], "iyzico")

    expect(await screen.findByText("Öncelikli sağlayıcı")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Öncelikli sağlayıcı" })).toHaveTextContent(
      "iyzico"
    )
  })

  it("has nothing to ask with one provider", () => {
    const { container } = renderRow(["paytr"], null)

    expect(container.querySelector("li")).toBeNull()
  })
})
