import { act, cleanup, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type {
  FeaturedProductSection,
  HeaderBarSection,
  HeaderCatalogSection,
  ProductsSection,
} from "@/features/storefront/api/layout"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { HEADER_CATALOG_DEFAULTS } from "@/features/storefront/layout/variants"
import { FIELD_IDS } from "./forms/field-registry"
import { renderPanel } from "./section-panel.fixtures"
import { openGroup, openTab, tabButton } from "./settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const rail = (id = "rafyeni001") => newHomeSection("products", id) as ProductsSection

const header: HeaderBarSection = {
  id: "mainheader",
  type: "header_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "standard",
  sticky: true,
  menu_images: "submenus",
  search_style: "field",
}
const catalog: HeaderCatalogSection = { ...header, variant: "catalog", ...HEADER_CATALOG_DEFAULTS }

const tabs = () => within(screen.getByRole("tablist")).getAllByRole("tab")
const selected = () => screen.getByRole("tab", { selected: true })
const toggle = (name: RegExp) => screen.getByRole("button", { name })
const search = () => screen.getByRole("searchbox", { name: "Bu bölümün ayarlarında ara" })
const hits = () =>
  within(screen.getByRole("list", { name: "Bulunan ayarlar" })).getAllByRole("button")

afterEach(() => {
  vi.restoreAllMocks()
})

/** adr/0065 Ek (sekmeler): a section's settings as three tabs of closed groups. */
describe("the settings panel's tabs", () => {
  it("offers İçerik, Stil and Gelişmiş as a tablist, one tab in the Tab order", () => {
    renderPanel(rail())
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      "İçerikcontent",
      "Stilstyle",
      "Gelişmişadvanced",
    ])
    expect(selected()).toHaveAccessibleName(/^İçerik/)
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
    const panel = screen.getByRole("tabpanel")
    expect(panel).toHaveAttribute("aria-labelledby", selected().id)
    expect(tabs().every((tab) => tab.getAttribute("aria-controls") === panel.id)).toBe(true)
  })

  it("moves with the arrows, Home and End, showing each tab at once and wrapping round", async () => {
    const user = userEvent.setup()
    renderPanel(rail())
    await user.click(screen.getByRole("tab", { name: /^İçerik/ }))
    await user.keyboard("{ArrowRight}")
    expect(selected()).toHaveAccessibleName(/^Stil/)
    expect(selected()).toHaveFocus()
    expect(toggle(/^Görünüm/)).toBeVisible()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(selected()).toHaveAccessibleName(/^İçerik/)
    await user.keyboard("{ArrowLeft}")
    expect(selected()).toHaveAccessibleName(/^Gelişmiş/)
    expect(toggle(/^Boşluk/)).toBeVisible()
    expect(screen.queryByRole("button", { name: /^Görünüm/ })).toBeNull()
    await user.keyboard("{Home}")
    expect(selected()).toHaveAccessibleName(/^İçerik/)
    await user.keyboard("{End}")
    expect(selected()).toHaveAccessibleName(/^Gelişmiş/)
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", selected().id)
  })

  it("closes every group but Biçim; a group alone in its tab stands open without a header", async () => {
    const user = userEvent.setup()
    renderPanel(rail())
    // İçerik holds the content alone: no header to fold, its fields shown
    expect(screen.queryByRole("button", { name: "İçerik" })).toBeNull()
    expect(screen.getByRole("heading", { level: 3, name: "İçerik" })).toHaveClass("sr-only")
    await openTab(user, "style")
    expect(toggle(/^Biçim/)).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("radio", { name: /Kayan sıra/ })).toBeVisible()
    for (const name of [/^Diziliş/, /^Görünüm/]) {
      expect(toggle(name)).toHaveAttribute("aria-expanded", "false")
    }
    await openTab(user, "advanced")
    for (const name of [/^Boşluk/, /^Görünürlük/]) {
      expect(toggle(name)).toHaveAttribute("aria-expanded", "false")
    }
  })

  it("keeps what was typed in one tab while another is shown", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(rail())
    const input = screen.getByRole("textbox", { name: /^Başlık/ })
    await user.type(input, "Yeni gelenler")
    await openTab(user, "style")
    await openTab(user, "content")
    expect(input).toHaveValue("Yeni gelenler")
    expect(changes.at(-1)).toMatchObject({ title: "Yeni gelenler" })
  })

  it("remembers a group the shop opened for the next section of its type", async () => {
    const user = userEvent.setup()
    window.localStorage.clear()
    const first = renderPanel(rail("rafbirinci"))
    await openGroup(user, /^Görünüm/)
    first.unmount()
    renderPanel(rail("rafikinci1"))
    await openTab(user, "style")
    expect(toggle(/^Görünüm/)).toHaveAttribute("aria-expanded", "true")
    expect(toggle(/^Diziliş/)).toHaveAttribute("aria-expanded", "false")
    window.localStorage.clear()
  })

  it("works without storage (a private window): the groups open and close, nothing kept", async () => {
    const user = userEvent.setup()
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    renderPanel(rail())
    await openGroup(user, /^Görünüm/)
    expect(toggle(/^Görünüm/)).toHaveAttribute("aria-expanded", "true")
    await user.click(toggle(/^Görünüm/))
    expect(toggle(/^Görünüm/)).toHaveAttribute("aria-expanded", "false")
  })

  it("marks a tab holding a setting off its default, and the group how many", async () => {
    const user = userEvent.setup()
    const look = {
      ground: "stage",
      align: null,
      width: null,
      space_outer: null,
      space_below: null,
      space_inner: "large",
    } as const
    renderPanel({ ...rail(), look })
    const dot = (tab: "content" | "style" | "advanced") =>
      tabButton(tab)?.querySelector("[data-tab-marked]") ?? null
    expect(dot("style")).not.toBeNull()
    expect(dot("advanced")).not.toBeNull()
    expect(dot("content")).toBeNull()
    expect(tabButton("style")).toHaveAccessibleName(/varsayılandan farklı ayar var/)
    await openTab(user, "style")
    expect(toggle(/^Görünüm/)).toHaveAccessibleName("Görünüm, 1 ayar varsayılandan farklı")
  })
})

describe("a group whose form gives no count", () => {
  it("counts its settings showing Varsayılana dön, and the mark goes with the default", async () => {
    const user = userEvent.setup()
    const featured = newHomeSection("featured_product", "onecikan01") as FeaturedProductSection
    renderPanel({ ...featured, gallery: "strips" })
    expect(tabButton("style")?.querySelector("[data-tab-marked]")).not.toBeNull()
    await openTab(user, "style")
    expect(toggle(/^Diziliş/)).toHaveAccessibleName("Diziliş, 1 ayar varsayılandan farklı")
    await openGroup(user, /^Diziliş/)
    await user.click(screen.getByRole("button", { name: "Varsayılana dön" }))
    expect(toggle(/^Diziliş/)).toHaveAccessibleName("Diziliş")
    expect(tabButton("style")?.querySelector("[data-tab-marked]")).toBeNull()
  })
})

describe("the catalog header's groups", () => {
  it("count the settings off their defaults in each group's title, the tab dotted", async () => {
    const user = userEvent.setup()
    renderPanel({ ...catalog, search_label: true, search_style: "icon", phone: false }, "header")
    expect(toggle(/^Arama/)).toHaveAccessibleName(/2 ayar varsayılandan farklı/)
    expect(toggle(/^Simgeler ve iletişim/)).toHaveAccessibleName(/1 ayar varsayılandan farklı/)
    expect(toggle(/^Menü çubuğu/)).not.toHaveAccessibleName(/farklı/)
    expect(tabButton("content")?.querySelector("[data-tab-marked]")).not.toBeNull()
    // Put back, the mark goes
    await openGroup(user, /^Simgeler ve iletişim/)
    await user.click(screen.getByRole("switch", { name: /Telefon/ }))
    expect(toggle(/^Simgeler ve iletişim/)).not.toHaveAccessibleName(/farklı/)
  })

  it("takes a field picked in the preview to its group: the Kategoriler button in Menü çubuğu", () => {
    const { pick } = renderPanel(catalog, "header")
    // "İçerik" opens at its first group, the search; the menu bar stands closed
    expect(toggle(/^Arama/)).toHaveAttribute("aria-expanded", "true")
    expect(toggle(/^Menü çubuğu/)).toHaveAttribute("aria-expanded", "false")
    const target = FIELD_IDS.header(catalog.id, "categories_button")
    act(() => {
      pick({ target, group: "menu", nonce: 1 })
    })
    expect(toggle(/^Menü çubuğu/)).toHaveAttribute("aria-expanded", "true")
    // The field or its control holds the focus
    expect(document.getElementById(target)?.contains(document.activeElement)).toBe(true)
  })
})

describe("the panel's own search", () => {
  it("is told apart from the editor's search over every section", () => {
    renderPanel(rail())
    expect(search()).toHaveAttribute("placeholder", "Bu bölümün ayarlarında ara…")
  })

  it.each(["İÇ BOŞLUK", "ic bosluk", "iç BOSLUK", "İc Boşluk"])(
    "finds a setting whatever its case and Turkish letters: %s",
    async (query) => {
      const user = userEvent.setup()
      renderPanel(rail())
      await user.type(search(), query)
      expect(screen.queryByRole("tablist")).toBeNull()
      const hit = hits().find((each) => each.textContent.startsWith("İç boşluk"))
      expect(hit).toHaveTextContent("Gelişmiş › Boşluk")
    }
  )

  it("finds a choice by its name and a setting by its help text", async () => {
    const user = userEvent.setup()
    renderPanel(rail())
    await user.type(search(), "kayan sira")
    expect(hits()[0]).toHaveTextContent(/Kayan sıra/)
    expect(hits()[0]).toHaveTextContent("Stil › Biçim")
    await user.clear(search())
    // "Cihaz" says phones are the screens narrower than 1024 pixels
    await user.type(search(), "PIKSELDEN dar")
    expect(hits()[0]).toHaveTextContent(/^Cihaz/)
    expect(hits()[0]).toHaveTextContent("Gelişmiş › Görünürlük")
  })

  it("takes Enter to the first hit: its tab and group open, its control focused, the tabs back", async () => {
    const user = userEvent.setup()
    renderPanel(rail())
    expect(selected()).toHaveAccessibleName(/^İçerik/)
    await user.type(search(), "iç boşluk{Enter}")
    expect(search()).toHaveValue("")
    expect(selected()).toHaveAccessibleName(/^Gelişmiş/)
    expect(toggle(/^Boşluk/)).toHaveAttribute("aria-expanded", "true")
    const field = document.getElementById(FIELD_IDS.look("rafyeni001", "space_inner"))
    expect(field?.contains(document.activeElement)).toBe(true)
  })

  it("takes a hit picked from the list there too; Escape empties the search", async () => {
    const user = userEvent.setup()
    renderPanel(rail())
    await user.type(search(), "zemin")
    await user.keyboard("{ArrowDown}")
    expect(hits()[0]).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(selected()).toHaveAccessibleName(/^Stil/)
    expect(toggle(/^Görünüm/)).toHaveAttribute("aria-expanded", "true")

    await user.type(search(), "boşluk")
    await user.keyboard("{Escape}")
    expect(search()).toHaveValue("")
    expect(screen.getByRole("tablist")).toBeVisible()
  })

  it("says when nothing is found", async () => {
    const user = userEvent.setup()
    renderPanel(rail())
    await user.type(search(), "qqqq")
    expect(screen.getByText("“qqqq” için ayar bulunamadı.")).toBeVisible()
  })
})

describe("a field picked from outside the panel", () => {
  it("opens its tab and its closed group, and is focused", () => {
    const { pick } = renderPanel(rail())
    expect(selected()).toHaveAccessibleName(/^İçerik/)
    const target = FIELD_IDS.look("rafyeni001", "space_inner")
    act(() => {
      pick({ target, group: "spacing", nonce: 1 })
    })
    expect(selected()).toHaveAccessibleName(/^Gelişmiş/)
    expect(toggle(/^Boşluk/)).toHaveAttribute("aria-expanded", "true")
    expect(document.getElementById(target)?.contains(document.activeElement)).toBe(true)
  })

  it("is taken to again by a new pick after the shop moved away", async () => {
    const user = userEvent.setup()
    const { pick } = renderPanel(rail())
    const target = FIELD_IDS.look("rafyeni001", "ground")
    act(() => {
      pick({ target, group: "frame", nonce: 1 })
    })
    expect(selected()).toHaveAccessibleName(/^Stil/)
    await openTab(user, "content")
    act(() => {
      pick({ target, group: "frame", nonce: 2 })
    })
    expect(selected()).toHaveAccessibleName(/^Stil/)
    expect(document.getElementById(target)?.contains(document.activeElement)).toBe(true)
    cleanup()
  })
})
