import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderConsent, OrderContractCopy } from "@/features/orders/api/legal"
import { ContractsCard } from "./contracts-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const CONSENT: OrderConsent = {
  given_at: "2026-10-30T09:15:00.000Z",
  ip: "203.0.113.7",
  documents: [
    { kind: "distance_sales", version: 2 },
    { kind: "pre_information", version: 1 },
  ],
  copies: [
    {
      kind: "distance_sales",
      version: 2,
      title: "Mesafeli satış sözleşmesi",
      html_hash: "a".repeat(64),
      created_at: "2026-10-30T09:15:02.000Z",
    },
  ],
}

const COPY: OrderContractCopy = {
  kind: "distance_sales",
  version: 2,
  title: "Mesafeli satış sözleşmesi",
  html: "<p>Alıcı Ayşe Yılmaz</p>",
  html_hash: "a".repeat(64),
  intact: true,
  created_at: "2026-10-30T09:15:02.000Z",
}

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ContractsCard orderId="order_1" />
    </QueryClientProvider>
  )

describe("ContractsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows when and from where the contracts were accepted, and opens the copy kept", async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith("/legal")
          ? {
              consent: CONSENT,
              age_declaration: { min_age: 18, declared_at: "2026-10-30T09:14:00.000Z" },
            }
          : { document: COPY }
      )
    )
    renderCard()

    expect(await screen.findByText("203.0.113.7")).toBeInTheDocument()
    expect(screen.getByText(/18 yaş ve üstü/)).toBeInTheDocument()
    // The copy is a recorded read: asked for only when opened
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await userEvent.click(
      screen.getByRole("button", { name: "Mesafeli satış sözleşmesi · sürüm 2" })
    )

    const dialog = await screen.findByRole("dialog")
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/legal/distance_sales")
    expect(within(dialog).getByText(/Özeti \(SHA-256\) saklandığı günkü/)).toBeInTheDocument()
    expect(within(dialog).getByTitle(/Mesafeli satış sözleşmesi/)).toHaveAttribute("sandbox", "")
  })

  it("says so when the order was placed without contracts to accept", async () => {
    fetchMock.mockResolvedValue({ consent: null, age_declaration: null })
    renderCard()

    expect(await screen.findByText(/yayında sözleşmesi yoktu/)).toBeInTheDocument()
  })
})
