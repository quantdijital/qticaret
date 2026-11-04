import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, card, posts, renderPage } from "./preferences-page.fixtures"
import type { Init } from "./preferences-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The open tab comes from the address (`?part=stock`)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useSearch: () => ({ part: "stock" }),
  useNavigate: () => vi.fn(),
}))

describe("PreferencesPage: the low stock badge", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("saves the threshold, 0 turning the badge off", async () => {
    renderPage()
    const box = await screen.findByRole("spinbutton", { name: "Eşik" })
    const stock = card("Az kaldı rozeti")

    expect(box).toHaveValue("3")
    await userEvent.clear(box)
    await userEvent.type(box, "0")
    await userEvent.click(within(stock).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { low_stock_threshold: 0 },
      })
    })
  })

  it("takes no number above a thousand", async () => {
    renderPage()
    const box = await screen.findByRole("spinbutton", { name: "Eşik" })
    const stock = card("Az kaldı rozeti")

    await userEvent.clear(box)
    await userEvent.type(box, "1500")
    await userEvent.click(within(stock).getByRole("button", { name: "Kaydet" }))

    expect(within(stock).getByRole("alert")).toHaveTextContent(
      "0 ile 1000 arasında bir tam sayı yazın."
    )
    expect(posts(fetchMock)).toEqual([])
  })
})
