import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PriceListLine } from "@/features/price-lists/api/price-lists"
import { PriceLinesCard } from "./price-lines-card"

const sdkMock = vi.hoisted(() => ({
  fetch: vi.fn(),
  batchPrices: vi.fn(),
}))

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: sdkMock.fetch },
    admin: { priceList: { batchPrices: sdkMock.batchPrices } },
  },
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const line: PriceListLine = {
  price_id: "price_1",
  variant_id: "variant_1",
  variant_title: "Mavi",
  sku: "KUPA-MAVI",
  product_id: "prod_1",
  product_title: "Kupa",
  thumbnail: null,
  currency_code: "try",
  base: "100.00",
  price: "80.00",
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PriceLinesCard listId="plist_1" />
    </QueryClientProvider>
  )
}

describe("PriceLinesCard", () => {
  beforeEach(() => {
    sdkMock.fetch.mockReset()
    sdkMock.batchPrices.mockReset()
    sdkMock.batchPrices.mockResolvedValue({})
  })

  it("shows each variant beside its own price and how far below it the list is", async () => {
    sdkMock.fetch.mockResolvedValue({ lines: [line], overlaps: [] })
    renderCard()
    expect(await screen.findByText("Kupa")).toBeInTheDocument()
    expect(screen.getByText("Mavi · KUPA-MAVI")).toBeInTheDocument()
    expect(screen.getByLabelText("Kupa · Mavi liste fiyatı (TRY)")).toHaveValue("80,00")
    expect(screen.getByText("−%20")).toBeInTheDocument()
  })

  it("saves a typed price when the field is left, and only when it changed", async () => {
    sdkMock.fetch.mockResolvedValue({ lines: [line], overlaps: [] })
    renderCard()
    const field = await screen.findByLabelText("Kupa · Mavi liste fiyatı (TRY)")
    await userEvent.click(field)
    await userEvent.tab()
    expect(sdkMock.batchPrices).not.toHaveBeenCalled()

    await userEvent.clear(field)
    await userEvent.type(field, "75,50{Enter}")
    await waitFor(() => {
      expect(sdkMock.batchPrices).toHaveBeenCalledWith("plist_1", {
        update: [{ id: "price_1", variant_id: "variant_1", currency_code: "try", amount: 75.5 }],
      })
    })
  })

  it("puts the saved price back in the field when a save is refused", async () => {
    sdkMock.fetch.mockResolvedValue({ lines: [line], overlaps: [] })
    sdkMock.batchPrices.mockRejectedValue(new Error("refused"))
    renderCard()
    const field = await screen.findByLabelText("Kupa · Mavi liste fiyatı (TRY)")
    await userEvent.clear(field)
    await userEvent.type(field, "70{Enter}")
    await waitFor(() => {
      expect(field).toHaveValue("80,00")
    })
  })

  it("takes a line out of the list", async () => {
    sdkMock.fetch.mockResolvedValue({ lines: [line], overlaps: [] })
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Kupa · Mavi listeden çıkar" }))
    await waitFor(() => {
      expect(sdkMock.batchPrices).toHaveBeenCalledWith("plist_1", { delete: ["price_1"] })
    })
  })

  it("names other live lists pricing the same variants", async () => {
    sdkMock.fetch.mockResolvedValue({
      lines: [line],
      overlaps: [
        {
          id: "plist_2",
          title: "Kara Cuma",
          type: "override",
          starts_at: null,
          ends_at: null,
          variant_count: 1,
        },
      ],
    })
    renderCard()
    expect(
      await screen.findByText("Aynı ürünler başka bir fiyat listesinde de var")
    ).toBeInTheDocument()
    expect(screen.getByText("Kara Cuma: 1 ürün çeşidi")).toBeInTheDocument()
  })
})
