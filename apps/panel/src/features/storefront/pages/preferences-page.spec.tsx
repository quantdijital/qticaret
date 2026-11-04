import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, card, posts, renderPage } from "./preferences-page.fixtures"
import type { Init } from "./preferences-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const route = vi.hoisted(() => {
  const search: { part?: string } = {}
  return { search, navigate: vi.fn() }
})

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The open tab comes from the address (`?part=`); a tab chosen goes there
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useSearch: () => route.search,
  useNavigate: () => route.navigate,
}))

const THRESHOLD = "{ücretsiz_kargo_eşiği}"

describe("PreferencesPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    route.navigate.mockReset()
    route.search = {}
    answer(fetchMock)
  })

  it("opens the trust badges' tab first, the others one click away, the editor linked", async () => {
    renderPage()

    expect(await screen.findByRole("textbox", { name: "1. rozetin başlığı" })).toHaveValue(
      "Aynı gün kargo"
    )
    expect(screen.getByRole("combobox", { name: "1. rozetin simgesi" })).toHaveTextContent("Kargo")
    const tabs = within(screen.getByRole("tablist", { name: "Vitrin tercihleri" }))
    expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Güven rozetleri",
      "İletişim formu",
      "Renk örnekleri",
      "Az kaldı rozeti",
      "Bakım modu",
    ])
    // One card per tab: the others are not drawn below it
    expect(screen.queryByRole("heading", { name: "Renk örnekleri" })).toBeNull()
    // What moved to the theme editor is no longer here
    expect(screen.queryByRole("heading", { name: "Ana sayfa girişi" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Duyuru şeridi" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "Ana renk" })).toBeNull()
    expect(screen.getByRole("link", { name: "Tema düzenleyiciyi aç" })).toHaveAttribute(
      "href",
      "/storefront/editor"
    )

    await userEvent.click(tabs.getByRole("tab", { name: "Renk örnekleri" }))
    expect(route.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: ".", replace: true }))
    expect(fetchMock).toHaveBeenCalledWith(URL)
  })

  it("saves a badge without a description as none", async () => {
    renderPage()
    const title = await screen.findByRole("textbox", { name: "1. rozetin başlığı" })
    const badges = card("Güven rozetleri")

    await userEvent.type(title, " bugün")
    await userEvent.click(within(badges).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { trust_badges: [{ icon: "truck", title: "Aynı gün kargo bugün", text: null }] },
      })
    })
  })

  it("lists each shop detail with what it shows now, asked for only once the menu opens", async () => {
    renderPage()
    await screen.findByRole("textbox", { name: "1. rozetin başlığı" })
    const badges = card("Güven rozetleri")
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/shop-tokens")

    const [titleMenu] = within(badges).getAllByRole("button", { name: "Bilgi ekle" })
    if (!titleMenu) throw new Error("No menu beside the title")
    await userEvent.click(titleMenu)

    expect(await screen.findByRole("menuitem", { name: /Telefon\s*0212 123 45 67/ })).toBeVisible()
    expect(screen.getByRole("menuitem", { name: /Adres\s*henüz girilmedi/ })).toBeVisible()
    expect(screen.getAllByRole("menuitem")).toHaveLength(6)
  })

  it("puts a detail where the caret was, shows the line as the storefront will and saves it", async () => {
    renderPage()
    const text = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "1. rozetin açıklaması",
    })
    const badges = card("Güven rozetleri")

    const [, textMenu] = within(badges).getAllByRole("button", { name: "Bilgi ekle" })
    if (!textMenu) throw new Error("No menu beside the description")
    await userEvent.click(textMenu)
    await userEvent.click(await screen.findByRole("menuitem", { name: /Ücretsiz kargo eşiği/ }))

    expect(text).toHaveValue(THRESHOLD)
    expect(await within(badges).findByText("₺1.500")).toHaveTextContent("Vitrinde: ₺1.500")
    await userEvent.click(within(badges).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { trust_badges: [{ icon: "truck", title: "Aynı gün kargo", text: THRESHOLD }] },
      })
    })
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
    expect(posts(fetchMock)).toEqual([])
  })
})
