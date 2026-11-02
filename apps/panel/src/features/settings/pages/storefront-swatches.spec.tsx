import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, card, posts, renderPage } from "./storefront-page.fixtures"
import type { Init } from "./storefront-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The menus' card points at their own screen (adr/0049)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const TITLE = "Renk örnekleri"
const NAVY = { label: "Lacivert", hex: "#1e3a8a" }
const MAROON = { label: "Bordo", hex: "#7f1d1d" }

/** The card once the page has loaded. */
async function swatchesCard(): Promise<HTMLElement> {
  await screen.findByRole("heading", { name: TITLE })
  return card(TITLE)
}

describe("StorefrontPage: colour swatches (F18 D5)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("starts with only the add button and the help text", async () => {
    renderPage()
    const swatches = await swatchesCard()

    expect(within(swatches).getByText(/renkli yuvarlak olarak gösterilir/)).toBeInTheDocument()
    expect(within(swatches).getByRole("button", { name: "Renk ekle" })).toBeEnabled()
    expect(within(swatches).queryByRole("listitem")).not.toBeInTheDocument()
  })

  it("adds a colour and saves its code in lower case, the picker following the code", async () => {
    renderPage()
    const swatches = await swatchesCard()

    await userEvent.click(within(swatches).getByRole("button", { name: "Renk ekle" }))
    await userEvent.type(
      within(swatches).getByRole("textbox", { name: "1. rengin adı" }),
      " Lacivert "
    )
    const code = within(swatches).getByRole("textbox", { name: "1. rengin kodu" })
    await userEvent.clear(code)
    await userEvent.type(code, "#1E3A8A")

    expect(code).toHaveValue("#1e3a8a")
    expect(within(swatches).getByLabelText("1. rengin seçicisi")).toHaveValue("#1e3a8a")
    await userEvent.click(within(swatches).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { color_swatches: [NAVY] },
      })
    })
  })

  it("refuses a half code and a name written twice in another case, without a request", async () => {
    answer(fetchMock, { color_swatches: [NAVY] })
    renderPage()
    const swatches = await swatchesCard()
    expect(await within(swatches).findByRole("textbox", { name: "1. rengin adı" })).toHaveValue(
      "Lacivert"
    )

    await userEvent.click(within(swatches).getByRole("button", { name: "Renk ekle" }))
    const name = within(swatches).getByRole("textbox", { name: "2. rengin adı" })
    await userEvent.type(name, "LACİVERT")
    const code = within(swatches).getByRole("textbox", { name: "2. rengin kodu" })
    await userEvent.clear(code)
    await userEvent.type(code, "#1e3a8")
    await userEvent.click(within(swatches).getByRole("button", { name: "Kaydet" }))

    const alerts = await within(swatches).findAllByRole("alert")
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      "Her renk adı bir kez yazılabilir.",
      "Renk, # ile başlayan 6 haneli bir kod olmalı (#0b5c99 gibi).",
    ])
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(code).toHaveAttribute("aria-invalid", "true")
    expect(posts(fetchMock)).toEqual([])
  })

  it("removes a colour and saves the list without it", async () => {
    answer(fetchMock, { color_swatches: [NAVY, MAROON] })
    renderPage()
    const swatches = await swatchesCard()
    await within(swatches).findByRole("textbox", { name: "2. rengin adı" })

    await userEvent.click(within(swatches).getByRole("button", { name: "1. renk: kaldır" }))
    expect(within(swatches).getByRole("textbox", { name: "1. rengin adı" })).toHaveValue("Bordo")
    await userEvent.click(within(swatches).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { color_swatches: [MAROON] },
      })
    })
  })
})
