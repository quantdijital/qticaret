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

describe("StorefrontPage: colour and home page opening", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("saves a colour in lower case, refuses a half code, and goes back to the theme's", async () => {
    renderPage()
    const hex = await screen.findByRole("textbox", { name: "Ana renk" })
    const color = card("Renk")

    await userEvent.type(hex, "#0B5C9")
    await userEvent.click(within(color).getByRole("button", { name: "Kaydet" }))
    expect(await within(color).findByRole("alert")).toHaveTextContent(
      "Renk, # ile başlayan 6 haneli bir kod olmalı (#0b5c99 gibi)."
    )
    expect(posts(fetchMock)).toEqual([])

    await userEvent.type(hex, "9")
    await userEvent.click(within(color).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { primary_color: "#0b5c99" },
      })
    })
    expect(hex).toHaveValue("#0b5c99")

    const reset = within(color).getByRole("button", { name: "Temanın rengine dön" })
    await waitFor(() => {
      expect(reset).toBeEnabled()
    })
    await userEvent.click(reset)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { primary_color: null },
      })
    })
    await waitFor(() => {
      expect(hex).toHaveValue("")
    })
  })

  it("saves a hero with one button, empty fields as none and the text on one line", async () => {
    renderPage()
    const heading = await screen.findByRole("textbox", { name: "Başlık" })
    const hero = card("Ana sayfa girişi")

    await userEvent.type(heading, " Yeni sezon geldi ")
    await userEvent.type(
      within(hero).getByRole("textbox", { name: "Metin (isteğe bağlı)" }),
      "Aynı gün kargo{Enter}ve ücretsiz iade"
    )
    await userEvent.click(within(hero).getByRole("button", { name: "Düğme ekle" }))
    await userEvent.type(
      within(hero).getByRole("textbox", { name: "1. düğmenin yazısı" }),
      "Alışverişe başla"
    )
    await userEvent.type(
      within(hero).getByRole("textbox", { name: "1. düğmenin adresi" }),
      "/kampanyalar"
    )
    await userEvent.click(within(hero).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: {
          hero: {
            eyebrow: null,
            heading: "Yeni sezon geldi",
            text: "Aynı gün kargo ve ücretsiz iade",
            links: [{ label: "Alışverişe başla", href: "/kampanyalar" }],
          },
        },
      })
    })
  })

  it("asks for a heading once anything else is written, and sends nothing", async () => {
    renderPage()
    const eyebrow = await screen.findByRole("textbox", { name: "Üst satır (isteğe bağlı)" })
    const hero = card("Ana sayfa girişi")

    await userEvent.type(eyebrow, "Yeni sezon")
    await userEvent.click(within(hero).getByRole("button", { name: "Kaydet" }))

    expect(await within(hero).findByRole("alert")).toHaveTextContent("Bu alanı doldurun.")
    expect(within(hero).getByRole("textbox", { name: "Başlık" })).toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(posts(fetchMock)).toEqual([])
  })

  it("clears the hero back to the default with its button", async () => {
    const written = {
      eyebrow: "Yeni sezon",
      heading: "Yeni sezon geldi",
      text: null,
      links: [{ label: "Alışverişe başla", href: "/kampanyalar" }],
    }
    answer(fetchMock, { hero: written })
    renderPage()
    const heading = await screen.findByRole("textbox", { name: "Başlık" })
    const hero = card("Ana sayfa girişi")
    expect(heading).toHaveValue("Yeni sezon geldi")

    await userEvent.click(within(hero).getByRole("button", { name: "Varsayılana dön" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, { method: "POST", body: { hero: null } })
    })
    await waitFor(() => {
      expect(heading).toHaveValue("")
    })
    expect(within(hero).getByRole("button", { name: "Varsayılana dön" })).toBeDisabled()
  })

  it("saves a hero emptied field by field as none", async () => {
    answer(fetchMock, {
      hero: { eyebrow: null, heading: "Yeni sezon geldi", text: null, links: [] },
    })
    renderPage()
    const heading = await screen.findByRole("textbox", { name: "Başlık" })
    const hero = card("Ana sayfa girişi")

    await userEvent.clear(heading)
    await userEvent.click(within(hero).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, { method: "POST", body: { hero: null } })
    })
  })
})
