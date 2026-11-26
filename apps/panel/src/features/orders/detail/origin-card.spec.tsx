import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { OriginCard } from "./origin-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OriginCard orderId="order_1" />
    </QueryClientProvider>
  )

describe("OriginCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("names the source and the campaign words the landing had", async () => {
    fetchMock.mockResolvedValue({
      origin: {
        source: "email",
        utm_source: "bulten",
        utm_medium: "email",
        utm_campaign: null,
        referrer_host: null,
        landed_at: "2026-11-20T10:00:00.000Z",
      },
    })

    renderCard()

    expect(await screen.findByText("Sipariş kaynağı")).toBeInTheDocument()
    expect(screen.getByText("E-posta")).toBeInTheDocument()
    expect(screen.getByText("bulten")).toBeInTheDocument()
    expect(screen.queryByText("Kampanya adı")).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/origin")
  })

  it("is not there when nothing was recorded", async () => {
    fetchMock.mockResolvedValue({ origin: null })

    const { container } = renderCard()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(container).toBeEmptyDOMElement()
  })
})
