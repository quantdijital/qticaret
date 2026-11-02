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
// The open tab comes from the address (`?part=contact`)
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useSearch: () => ({ part: "contact" }),
  useNavigate: () => vi.fn(),
}))

const PAGE = "Formun gösterildiği sayfa"
const SHOW = "Vitrinde iletişim formu göster"

describe("PreferencesPage: contact form (adr/0047)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("moves the form to another page, lower-cased as the server keeps it", async () => {
    renderPage()
    const path = await screen.findByRole("textbox", { name: PAGE })
    const contact = card("İletişim formu")

    expect(path).toHaveValue("/iletisim")
    expect(within(contact).getByRole("switch", { name: SHOW })).toBeChecked()
    await userEvent.clear(path)
    await userEvent.type(path, " /Destek ")
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { contact_form_path: "/destek" },
      })
    })
  })

  it("refuses the home page and an address elsewhere before saving", async () => {
    renderPage()
    const path = await screen.findByRole("textbox", { name: PAGE })
    const contact = card("İletişim formu")

    for (const wrong of ["/", "https://example.com/iletisim", "/ile tisim"]) {
      await userEvent.clear(path)
      await userEvent.type(path, wrong)
      await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))
      expect(await within(contact).findByRole("alert")).toHaveTextContent(
        "Sayfa / ile başlayan bir mağaza sayfası olmalı"
      )
    }
    expect(path).toHaveAttribute("aria-invalid", "true")
    expect(posts(fetchMock)).toEqual([])
  })

  it("turned off, saves no page and hides the field; turned on again, offers the default", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: PAGE })
    const contact = card("İletişim formu")

    await userEvent.click(within(contact).getByRole("switch", { name: SHOW }))
    expect(within(contact).queryByRole("textbox", { name: PAGE })).not.toBeInTheDocument()
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { contact_form_path: null },
      })
    })
    await userEvent.click(within(contact).getByRole("switch", { name: SHOW }))
    expect(within(contact).getByRole("textbox", { name: PAGE })).toHaveValue("/iletisim")
  })
})
