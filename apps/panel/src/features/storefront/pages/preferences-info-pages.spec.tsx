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
// The open tab comes from the address (`?part=infoPages`)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useSearch: () => ({ part: "infoPages" }),
  useNavigate: () => vi.fn(),
}))

const TITLE = "Ödeme ve kargo sayfaları"
const PAYMENT = "Ödeme seçenekleri sayfası"
const SHIPPING = "Kargo ve teslimat sayfası"

describe("PreferencesPage: payment and shipping pages (adr/0046 Ek 2026-11-05)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("points the facts at the shop's own pages, lower-cased as the server keeps them", async () => {
    renderPage()
    const payment = await screen.findByRole("textbox", { name: PAYMENT })
    const pages = card(TITLE)

    expect(payment).toHaveValue("/odeme-secenekleri")
    expect(within(pages).getByRole("textbox", { name: SHIPPING })).toHaveValue("/kargo-ve-teslimat")
    await userEvent.clear(payment)
    await userEvent.type(payment, " /Taksit-Secenekleri ")
    await userEvent.click(within(pages).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: {
          payment_info_path: "/taksit-secenekleri",
          shipping_info_path: "/kargo-ve-teslimat",
        },
      })
    })
  })

  it("saves a field left empty as no page", async () => {
    renderPage()
    const shipping = await screen.findByRole("textbox", { name: SHIPPING })

    await userEvent.clear(shipping)
    await userEvent.click(within(card(TITLE)).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { payment_info_path: "/odeme-secenekleri", shipping_info_path: null },
      })
    })
  })

  it("refuses the home page and an address elsewhere before saving", async () => {
    renderPage()
    const payment = await screen.findByRole("textbox", { name: PAYMENT })
    const pages = card(TITLE)

    for (const wrong of ["/", "https://example.com/odeme", "/odeme secenekleri"]) {
      await userEvent.clear(payment)
      await userEvent.type(payment, wrong)
      await userEvent.click(within(pages).getByRole("button", { name: "Kaydet" }))
      expect(await within(pages).findByRole("alert")).toHaveTextContent(
        "Sayfa / ile başlayan bir mağaza sayfası olmalı"
      )
    }
    expect(payment).toHaveAttribute("aria-invalid", "true")
    expect(posts(fetchMock)).toEqual([])
  })
})
