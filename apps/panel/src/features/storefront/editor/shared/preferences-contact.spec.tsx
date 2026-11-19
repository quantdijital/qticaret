import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  URL,
  answer,
  form as card,
  posts,
  renderPanel as renderPage,
} from "./preferences-panel.fixtures"
import type { Init } from "./preferences-panel.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const PAGE = "Formun gösterildiği sayfa"
const SHOW = "Vitrinde iletişim formu göster"

const picker = () => screen.getByRole("combobox", { name: PAGE })

describe("the editor's storefront preferences: contact form (adr/0047)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("moves the form to another of İçerik's pages, kept by its id (adr/0073 Açık kararlar 3)", async () => {
    renderPage()
    await waitFor(() => {
      expect(picker()).toHaveTextContent("İletişim")
    })
    const contact = card("İletişim formu")
    expect(within(contact).getByRole("switch", { name: SHOW })).toBeChecked()

    await userEvent.click(picker())
    await userEvent.click(await screen.findByRole("option", { name: /^Destek/ }))
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { contact_page_id: "cnt_destek" },
      })
    })
  })

  it("reads a section saved before the ids as the page at its old address", async () => {
    answer(fetchMock, { contact_page_id: null, contact_form_path: "/iletisim" })
    renderPage()

    await waitFor(() => {
      expect(picker()).toHaveTextContent("İletişim")
    })
    expect(within(card("İletişim formu")).getByRole("switch", { name: SHOW })).toBeChecked()
  })

  it("says the page was deleted, without refusing the card", async () => {
    answer(fetchMock, { contact_page_id: "cnt_silindi" })
    renderPage()

    expect(
      await screen.findByText(
        "Seçili sayfa silinmiş; vitrinde gösterilmiyor. Başka bir sayfa seçin."
      )
    ).toBeVisible()
    expect(picker()).toHaveTextContent("Silinmiş sayfa")
  })

  it("turned off, saves no page and hides the picker; on again, asks for a page", async () => {
    answer(fetchMock, { contact_page_id: null, contact_form_path: null })
    renderPage()
    const contact = await waitFor(() => card("İletişim formu"))
    const show = within(contact).getByRole("switch", { name: SHOW })
    expect(show).not.toBeChecked()
    expect(within(contact).queryByRole("combobox", { name: PAGE })).not.toBeInTheDocument()

    await userEvent.click(show)
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    expect(await within(contact).findByRole("alert")).toHaveTextContent("Bir sayfa seçin.")
    expect(posts(fetchMock)).toEqual([])
  })

  it("turned off, saves the role as none", async () => {
    renderPage()
    await waitFor(() => {
      expect(picker()).toHaveTextContent("İletişim")
    })
    const contact = card("İletişim formu")

    await userEvent.click(within(contact).getByRole("switch", { name: SHOW }))
    expect(within(contact).queryByRole("combobox", { name: PAGE })).not.toBeInTheDocument()
    await userEvent.click(within(contact).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { contact_page_id: null },
      })
    })
  })
})
