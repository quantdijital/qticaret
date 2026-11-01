import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnsSettings } from "@/features/settings/api/sections"
import { ReturnsCard } from "./returns-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const SAVED: ReturnsSettings = { withdrawal_days: 14, return_shipping: "shop" }

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReturnsCard />
    </QueryClientProvider>
  )

describe("ReturnsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: Partial<ReturnsSettings> }) =>
      Promise.resolve({ values: { ...SAVED, ...init?.body } })
    )
  })

  it("refuses fewer days than the law's 14, and saves a longer period the shopper pays back", async () => {
    renderCard()
    const days = await screen.findByRole("textbox", { name: "Cayma süresi (gün)" })
    expect(days).toHaveValue("14")

    await userEvent.clear(days)
    await userEvent.type(days, "10")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("14 ile 365")

    await userEvent.clear(days)
    await userEvent.type(days, "30")
    await userEvent.click(screen.getByRole("combobox", { name: "İade kargosunu ödeyen" }))
    await userEvent.click(await screen.findByRole("option", { name: "Müşteri" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/returns", {
        method: "POST",
        body: { withdrawal_days: 30, return_shipping: "customer" },
      })
    })
  })

  // The form keeps dirty values on a background refetch; undo must not
  it("puts back what was saved on undo, even in a field typed in", async () => {
    renderCard()
    const days = await screen.findByRole("textbox", { name: "Cayma süresi (gün)" })

    await userEvent.clear(days)
    await userEvent.type(days, "30")
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))

    expect(days).toHaveValue("14")
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/platform-settings/returns",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("shows what the server stored after a save, not the text typed", async () => {
    renderCard()
    const days = await screen.findByRole("textbox", { name: "Cayma süresi (gün)" })

    await userEvent.clear(days)
    await userEvent.type(days, "030")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(days).toHaveValue("30")
    })
  })
})
