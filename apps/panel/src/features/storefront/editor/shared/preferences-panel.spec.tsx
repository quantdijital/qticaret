import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, form, renderPanel } from "./preferences-panel.fixtures"
import type { Init } from "./preferences-panel.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe("the theme editor's storefront preferences (the owner, 2026-11-16)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("holds the contact form and the info pages, saved at once and said to be apart from the draft", async () => {
    const back = vi.fn()
    renderPanel(back)

    expect(await screen.findByRole("form", { name: "İletişim formu" })).toBeVisible()
    expect(form("Ödeme ve kargo sayfaları")).toBeVisible()
    expect(screen.getByText(/taslağa girmez/)).toBeVisible()
    expect(screen.getByText(/Yayınla'yı beklemez/)).toBeVisible()
    // Maintenance closes the storefront at once: it is Settings', not the editor's
    expect(screen.queryByRole("switch", { name: /Vitrini bakıma al/ })).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(URL)

    await userEvent.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(back).toHaveBeenCalled()
  })
})
