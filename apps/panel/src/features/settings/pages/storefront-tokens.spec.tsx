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

const THRESHOLD = "{ücretsiz_kargo_eşiği}"

describe("StorefrontPage: the shop's details in its texts (adr/0048)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("lists each detail with what it shows now, and asks for them only once opened", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. duyuru" })
    const announcements = card("Duyuru şeridi")
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/shop-tokens")

    await userEvent.click(within(announcements).getByRole("button", { name: "Bilgi ekle" }))

    expect(await screen.findByRole("menuitem", { name: /Telefon\s*0212 123 45 67/ })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: /Ücretsiz kargo eşiği\s*₺1\.500/ })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: /Adres\s*henüz girilmedi/ })).toBeVisible()
    expect(screen.getAllByRole("menuitem")).toHaveLength(6)
  })

  it("puts a detail in place of the selection, shows the line as the storefront will and saves it", async () => {
    renderPage()
    const line = await screen.findByRole<HTMLInputElement>("textbox", { name: "1. duyuru" })
    const announcements = card("Duyuru şeridi")

    // "1500 TL" selected, then the menu
    await userEvent.click(line)
    line.setSelectionRange(0, 7)
    await userEvent.click(within(announcements).getByRole("button", { name: "Bilgi ekle" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /Ücretsiz kargo eşiği/ }))

    expect(line).toHaveValue(`${THRESHOLD} ve üzeri kargo bedava`)
    // Back in the field, the caret after the detail
    await waitFor(() => {
      expect(line).toHaveFocus()
    })
    expect(line.selectionStart).toBe(THRESHOLD.length)
    expect(
      await within(announcements).findByText("₺1.500 ve üzeri kargo bedava")
    ).toHaveTextContent("Vitrinde: ₺1.500 ve üzeri kargo bedava")

    await userEvent.click(within(announcements).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { announcements: [`${THRESHOLD} ve üzeri kargo bedava`] },
      })
    })
  })

  it("adds a detail at the end of a field not typed in, and shows no line without one", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. duyuru" })
    const hero = card("Ana sayfa girişi")
    const text = within(hero).getByRole("textbox", { name: /Metin/ })
    expect(within(hero).queryByText(/Vitrinde:/)).toBeNull()

    // The eyebrow's, the heading's, then the text's menu
    const [, , textMenu] = within(hero).getAllByRole("button", { name: "Bilgi ekle" })
    if (!textMenu) throw new Error("No menu beside the text")
    await userEvent.click(textMenu)
    await userEvent.click(await screen.findByRole("menuitem", { name: /Telefon/ }))

    expect(text).toHaveValue("{telefon}")
    expect(await within(hero).findByText("0212 123 45 67")).toHaveTextContent(
      "Vitrinde: 0212 123 45 67"
    )
  })

  it("refuses a detail the shop does not have before saving", async () => {
    renderPage()
    const title = await screen.findByRole("textbox", { name: "1. rozetin başlığı" })
    const badges = card("Güven rozetleri")

    // `{{` is user-event's way to type a brace
    await userEvent.type(title, " {{kargo}")
    await userEvent.click(within(badges).getByRole("button", { name: "Kaydet" }))

    expect(await within(badges).findByRole("alert")).toHaveTextContent(
      "Süslü parantez içinde tanınmayan bir bilgi var"
    )
    // The line shows it as typed: the storefront would too, were it saved
    expect(within(badges).getByText("Aynı gün kargo {kargo}")).toHaveTextContent(
      "Vitrinde: Aynı gün kargo {kargo}"
    )
    expect(posts(fetchMock)).toEqual([])
  })
})
