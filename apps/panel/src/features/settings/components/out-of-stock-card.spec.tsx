import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { InventorySettings } from "@/features/settings/api/sections"
import { OutOfStockCard } from "./out-of-stock-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("OutOfStockCard (T1)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: Partial<InventorySettings> }) =>
      Promise.resolve({
        section: "inventory",
        version: 1,
        // An older backend's row: no choice stored yet
        values: { low_stock_threshold: 5, ...init?.body },
      })
    )
  })

  function renderCard() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <OutOfStockCard />
      </QueryClientProvider>
    )
  }

  it("shows them by default and saves the choice to hide them", async () => {
    renderCard()
    expect(await screen.findByRole("radio", { name: /Göster/ })).toBeChecked()
    await userEvent.click(screen.getByRole("radio", { name: /Listelerde gizle/ }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/inventory",
        expect.objectContaining({ method: "POST", body: { out_of_stock_listing: "hide" } })
      )
    })
  })
})
