import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  holdClock,
  lastSaved,
  opened,
  pass,
  releaseClock,
  renderEditor,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init } from "./theme-editor.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

const step = () => screen.queryByRole("region", { name: "Bölüm ekle" })
const homeIds = () => lastSaved(fetchMock)?.home.map((section) => section.id)

/** "Bölüm ekle" as a step of the side panel, aimed at the end or between two rows. */
describe("adding a section in the theme editor", () => {
  let user: UserEvent
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
    user = holdClock()
    renderEditor()
  })
  afterEach(() => {
    releaseClock()
  })

  it("opens in the list's place with its way back, finds a type, and Escape goes up", async () => {
    const tree = await opened()
    await user.click(within(tree).getByRole("button", { name: "Bölüm ekle" }))
    const picker = await screen.findByRole("region", { name: "Bölüm ekle" })
    expect(tree).not.toBeVisible()
    // The breadcrumb leads back to the page's parts
    expect(within(picker).getByRole("navigation", { name: "Konum" })).toHaveTextContent("Ana sayfa")
    const search = within(picker).getByRole("searchbox", { name: "Bölüm ara" })
    expect(search).toHaveAttribute("placeholder")
    expect(search).toHaveFocus()

    await user.type(search, "sorulan")
    expect(within(picker).getAllByRole("button", { name: /Sık sorulan/ })).toHaveLength(1)
    expect(within(picker).queryByRole("button", { name: /Kayan yazı/ })).toBeNull()
    await user.clear(search)
    await user.type(search, "zzzz")
    expect(picker).toHaveTextContent("Aramanızla eşleşen bölüm yok.")

    // The first Escape clears the search, the next goes back to the list
    await user.keyboard("{Escape}")
    expect(search).toHaveValue("")
    expect(step()).not.toBeNull()
    await user.keyboard("{Escape}")
    expect(step()).toBeNull()
    expect(tree).toBeVisible()

    // The breadcrumb goes back too
    await user.click(within(tree).getByRole("button", { name: "Bölüm ekle" }))
    await user.click(
      within(await screen.findByRole("navigation", { name: "Konum" })).getByRole("button", {
        name: "Ana sayfa",
      })
    )
    expect(step()).toBeNull()
  })

  it("adds the section where the '+' between two rows stood and opens it", async () => {
    const tree = await opened()
    const lines = within(tree).getAllByRole("button", { name: /bölümünün üstüne bölüm ekle$/ })
    // Above the home page's second section: between the hero and the products
    const home = within(tree).getByRole("list", { name: "Ana sayfa" })
    const [, between] = within(home).getAllByRole("button", {
      name: /bölümünün üstüne bölüm ekle$/,
    })
    if (!between) {
      throw new Error("no '+' between the first two rows")
    }
    expect(lines).toContain(between)
    await user.click(between)
    const picker = await screen.findByRole("region", { name: "Bölüm ekle" })
    expect(picker).toHaveTextContent("Seçtiğiniz yere eklenir")
    await user.click(within(picker).getByRole("button", { name: /Metin/ }))
    await pass(0)
    await waitFor(() => {
      expect(homeIds()).toHaveLength(4)
    })
    const [first, added, then] = homeIds() ?? []
    expect([first, then]).toEqual(["girisbolumu", "yeniurunler"])
    expect(lastSaved(fetchMock)?.home[1]?.type).toBe("rich_text")
    // Its settings open in the step's place
    expect(step()).toBeNull()
    expect(await screen.findByRole("region", { name: /Metin/ })).toBeVisible()
    expect(added).toBeDefined()
  })

  it("adds below a row from its menu, the touch screen's way between rows", async () => {
    const tree = await opened()
    const home = within(tree).getByRole("list", { name: "Ana sayfa" })
    const [menu] = within(home).getAllByRole("button", { name: /için işlemler$/ })
    if (!menu) {
      throw new Error("no row menu")
    }
    await user.click(menu)
    await user.click(await screen.findByRole("menuitem", { name: "Altına bölüm ekle" }))
    const picker = await screen.findByRole("region", { name: "Bölüm ekle" })
    await user.click(within(picker).getByRole("button", { name: /Metin/ }))
    await pass(0)
    await waitFor(() => {
      expect(homeIds()).toHaveLength(4)
    })
    expect(homeIds()?.[0]).toBe("girisbolumu")
    expect(homeIds()?.[2]).toBe("yeniurunler")
  })
})
