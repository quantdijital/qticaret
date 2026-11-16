import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import type { AnySection, HeaderBarSection } from "@/features/storefront/api/layout"
import {
  HEADER_CATALOG_DEFAULTS,
  isUnbuilt,
  switchVariant,
} from "@/features/storefront/layout/variants"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { SectionPanel } from "../section-panel"
import { searchSettings } from "../settings-search"
import { openGroup, openGroups, openTab } from "../settings-groups.fixtures"
import { headerCatalogIn } from "./field-registry"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const standard: HeaderBarSection = {
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

/** The bar's panel as the editor holds it, its groups closed at first: every change kept. */
function renderBar(section: HeaderBarSection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState<AnySection>(section)
    return (
      <SectionPanel
        section={value}
        group="header"
        problems={{}}
        canDuplicate={false}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

/** adr/0049 Ek 2026-11-14 N14, Ek 2026-11-15: the catalog header in the panel. */
describe("the catalog header's settings", () => {
  it("is offered, and a bar switched to it starts from the defaults and drops them when switched back", () => {
    expect(isUnbuilt("header_bar", "catalog")).toBe(false)
    const catalog = switchVariant(standard, "catalog")
    expect(catalog).toEqual({ ...standard, variant: "catalog", ...HEADER_CATALOG_DEFAULTS })
    const back = switchVariant({ ...catalog, phone: false } as HeaderBarSection, "standard")
    expect(back).toEqual(standard)
  })

  it("puts each setting in the part of the bar it fills, in the form's order", async () => {
    expect(headerCatalogIn("search")).toEqual([
      "search_placeholder",
      "search_width",
      "search_label",
    ])
    expect(headerCatalogIn("topBar")).toEqual([
      "utility_bar",
      "strip_note",
      "strip_note_link",
      "top_links",
    ])
    expect(headerCatalogIn("menu")).toEqual(["categories_button", "menu_ground", "highlight_link"])
    expect(headerCatalogIn("icons")).toEqual(["phone", "tools_place", "account_text", "cart_total"])
    expect(headerCatalogIn("content")).toEqual([])
    expect(headerCatalogIn("look")).toEqual([])
    // In the panel: four closed groups under "İçerik", no "İçerik" group of its own
    const user = userEvent.setup()
    renderBar(switchVariant(standard, "catalog"))
    await openTab(user, "content")
    for (const title of ["Arama", "Üst şerit", "Menü çubuğu", "Simgeler ve iletişim"]) {
      expect(screen.getByRole("button", { name: title })).toHaveAttribute("aria-expanded", "false")
    }
    expect(screen.queryByRole("button", { name: "İçerik" })).toBeNull()
  })

  it("offers the three layout choices, each starting at today's drawing", async () => {
    const user = userEvent.setup()
    const changes = renderBar(switchVariant(standard, "catalog"))
    await openGroups(user, "Arama", "Üst şerit", "Simgeler ve iletişim")
    const choice = (name: RegExp) => screen.getByRole("radiogroup", { name })
    const names = (name: RegExp) =>
      within(choice(name))
        .getAllByRole("radio")
        .map((each) => each.textContent)
    expect(names(/Arama kutusunun genişliği/)).toEqual(["Geniş", "Dar"])
    expect(names(/Üst menü bağlantılarının yeri/)).toEqual(["Üst şeritte", "Menü çubuğunda"])
    expect(names(/simgelerinin yeri/)).toEqual(["Menü çubuğunda", "Logo satırında"])
    expect(
      within(choice(/Arama kutusunun genişliği/)).getByRole("radio", { name: "Geniş" })
    ).toBeChecked()
    await user.click(
      within(choice(/Arama kutusunun genişliği/)).getByRole("radio", { name: "Dar" })
    )
    expect(changes.at(-1)).toMatchObject({ search_width: "narrow" })
    await user.click(
      within(choice(/Üst menü bağlantılarının yeri/)).getByRole("radio", { name: "Menü çubuğunda" })
    )
    expect(changes.at(-1)).toMatchObject({ top_links: "bar" })
    // Off the default, it offers the way back
    const width = document.getElementById("mainheader-header-search_width") ?? document.body
    await user.click(within(width).getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ search_width: "wide" })
  })

  it("hides what the tools in the logo row leave without a job", async () => {
    const user = userEvent.setup()
    const changes = renderBar(switchVariant(standard, "catalog"))
    await openGroups(user, "Üst şerit", "Simgeler ve iletişim")
    expect(screen.getByRole("switch", { name: /Üst şeritte “Hesabım” yazısı/ })).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Logo satırında" }))
    expect(changes.at(-1)).toMatchObject({ tools_place: "row" })
    // The row carries "Hesabım": the strip's written one is no longer offered
    expect(screen.queryByRole("switch", { name: /Üst şeritte “Hesabım” yazısı/ })).toBeNull()
    expect(screen.getByRole("switch", { name: /Üst yardımcı şerit/ })).toBeInTheDocument()
    // With the top links on the bar too, the strip is still offered: its note may be all it holds
    await user.click(
      within(screen.getByRole("radiogroup", { name: /Üst menü bağlantılarının yeri/ })).getByRole(
        "radio",
        { name: "Menü çubuğunda" }
      )
    )
    expect(screen.getByRole("switch", { name: /Üst yardımcı şerit/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Şerit notu/)).toBeInTheDocument()
  })

  it("offers the strip's note and its link right under the strip, only while it is on", async () => {
    const user = userEvent.setup()
    const changes = renderBar(switchVariant(standard, "catalog"))
    await openGroup(user, "Üst şerit")
    const order = [
      ...document.querySelectorAll(
        "#mainheader-header-utility_bar, #mainheader-header-strip_note, #mainheader-header-strip_note_link, #mainheader-header-top_links"
      ),
    ].map((each) => each.id)
    expect(order).toEqual([
      "mainheader-header-utility_bar",
      "mainheader-header-strip_note",
      "mainheader-header-strip_note_link",
      "mainheader-header-top_links",
    ])
    expect(screen.getByText(/Örnek: 1500 TL üzeri kargo bedava/)).toBeInTheDocument()
    const note = screen.getByLabelText(/Şerit notu/)
    expect(note).toHaveAttribute("maxLength", "80")
    await user.type(note, "Kargo bedava")
    expect(changes.at(-1)).toMatchObject({ strip_note: "Kargo bedava" })
    await user.clear(note)
    expect(changes.at(-1)).toMatchObject({ strip_note: null })
    const linkBox = document.getElementById("mainheader-header-strip_note_link") ?? document.body
    expect(within(linkBox).getByText("Not bağlantısı")).toBeInTheDocument()
    expect(within(linkBox).getByRole("button", { name: "Bağlantı seç" })).toBeInTheDocument()
    // The strip off: its note and link go with it
    await user.click(screen.getByRole("switch", { name: /Üst yardımcı şerit/ }))
    expect(changes.at(-1)).toMatchObject({ utility_bar: false })
    expect(screen.queryByLabelText(/Şerit notu/)).toBeNull()
    expect(document.getElementById("mainheader-header-strip_note_link")).toBeNull()
  })

  it("shows today's bar only its search, its pictures' steps and sticky switch", async () => {
    const user = userEvent.setup()
    renderBar(standard)
    // Staying at the top is Gelişmiş's one group: open, no header to fold it
    await openTab(user, "advanced")
    expect(screen.getByRole("switch", { name: /Üst bilgi sabit kalsın/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Diğer ayarlar" })).toBeNull()
    await openTab(user, "content")
    expect(
      screen.getAllByRole("button", { expanded: false }).map((each) => each.textContent)
    ).toEqual(["Arama", "Menü çubuğu"])
    await openGroup(user, "Menü çubuğu")
    const steps = screen.getByRole("radiogroup", {
      name: /Menüde kategori resimleri/,
    })
    expect(
      within(steps)
        .getAllByRole("radio")
        .map((each) => each.textContent)
    ).toEqual(["Her yerde", "Alt menülerde", "Yok"])
    // The default, the drawing from before the setting, is chosen and offers no reset
    expect(within(steps).getByRole("radio", { name: "Alt menülerde" })).toBeChecked()
    expect(screen.queryByRole("button", { name: /Varsayılana dön/ })).toBeNull()
    expect(screen.queryByText(/Menü çubuğu zemini/)).toBeNull()
  })

  it("picks each step on today's bar too, and goes back to the default", async () => {
    const user = userEvent.setup()
    const changes = renderBar(standard)
    await openGroup(user, "Menü çubuğu")
    await user.click(screen.getByRole("radio", { name: "Yok" }))
    expect(changes.at(-1)).toMatchObject({
      variant: "standard",
      menu_images: "off",
    })
    await user.click(screen.getByRole("radio", { name: "Her yerde" }))
    expect(changes.at(-1)).toMatchObject({ menu_images: "all" })
    await user.click(screen.getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ menu_images: "submenus" })
  })

  it("puts the pictures' steps right under the catalog's Kategoriler button, kept across variants", async () => {
    const catalog = switchVariant({ ...standard, menu_images: "all" }, "catalog")
    expect(catalog).toMatchObject({ menu_images: "all" })
    expect(switchVariant(catalog, "centered")).toMatchObject({
      menu_images: "all",
    })
    const user = userEvent.setup()
    const changes = renderBar(catalog)
    await openGroup(user, "Menü çubuğu")
    const order = [
      ...document.querySelectorAll("#mainheader-header-categories_button, #mainheader-menu-images"),
    ].map((each) => each.id)
    expect(order).toEqual(["mainheader-header-categories_button", "mainheader-menu-images"])
    expect(screen.getByRole("radio", { name: "Her yerde" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Alt menülerde" }))
    expect(changes.at(-1)).toMatchObject({
      variant: "catalog",
      menu_images: "submenus",
    })
  })

  it("changes what the catalog bar shows, its ground and words", async () => {
    const user = userEvent.setup()
    const changes = renderBar(switchVariant(standard, "catalog"))
    await openGroups(user, "Arama", "Menü çubuğu", "Simgeler ve iletişim")
    await user.click(screen.getByRole("switch", { name: /Telefon numarası/ }))
    expect(changes.at(-1)).toMatchObject({ phone: false })
    await user.click(screen.getByRole("radio", { name: "Ana renk" }))
    expect(changes.at(-1)).toMatchObject({ menu_ground: "primary" })
    await user.type(screen.getByLabelText(/Arama kutusundaki yazı/), "Kod ara")
    expect(changes.at(-1)).toMatchObject({ search_placeholder: "Kod ara" })
    await user.clear(screen.getByLabelText(/Arama kutusundaki yazı/))
    expect(changes.at(-1)).toMatchObject({ search_placeholder: null })
    // The finer switches stand with the part of the bar they change
    await user.click(screen.getByRole("switch", { name: /Sepette tutarı göster/ }))
    expect(changes.at(-1)).toMatchObject({ cart_total: true })
    expect(
      within(screen.getByRole("group", { name: "Arama" })).getByRole("switch", {
        name: /Arama düğmesi yazılı olsun/,
      })
    ).toBeInTheDocument()
  })

  it("is found by its everyday words and technical terms", () => {
    const t = i18next.t.bind(i18next)
    const section = switchVariant(standard, "catalog")
    const keys = (query: string) =>
      searchSettings(query, [{ section, group: "header", names: [] }], t).map(
        (hit) => hit.field?.key ?? null
      )
    expect(keys("zemin")).toContain("header.menu_ground")
    expect(keys("placeholder")).toContain("header.search_placeholder")
    expect(keys("kategoriler")).toContain("header.categories_button")
    // The layout choices by their names, terms and steps
    expect(keys("genişliği")).toContain("header.search_width")
    expect(keys("dar")).toContain("header.search_width")
    expect(keys("top links")).toContain("header.top_links")
    expect(keys("logo satırında")).toEqual(["header.tools_place"])
    // Tools in the row: the strip's written "Hesabım" is not offered, so not found
    const row = { ...section, tools_place: "row" } as HeaderBarSection
    expect(
      searchSettings("hesabım yazısı", [{ section: row, group: "header", names: [] }], t).map(
        (hit) => hit.field?.key ?? null
      )
    ).not.toContain("header.account_text")
    expect(keys("tutar")).toContain("header.cart_total")
    // The strip's note by its words and term, only while the strip is on
    expect(keys("şerit notu")).toContain("header.strip_note")
    expect(keys("strip note")).toContain("header.strip_note")
    expect(keys("not bağlantısı")).toContain("header.strip_note_link")
    const off = { ...section, utility_bar: false } as HeaderBarSection
    expect(
      searchSettings("şerit notu", [{ section: off, group: "header", names: [] }], t).map(
        (hit) => hit.field?.key ?? null
      )
    ).not.toContain("header.strip_note")
    expect(keys("thumbnails")).toEqual(["menu_images"])
    expect(keys("alt menülerde")).toEqual(["menu_images"])
    expect(
      searchSettings("kategori resim", [{ section: standard, group: "header", names: [] }], t).map(
        (hit) => hit.field?.key ?? null
      )
    ).toEqual(["menu_images"])
    expect(
      searchSettings("telefon", [{ section: standard, group: "header", names: [] }], t)
    ).toEqual([])
  })

  it("names a too long placeholder and a written link without words", () => {
    const section = {
      ...switchVariant(standard, "catalog"),
      search_placeholder: "a".repeat(61),
      highlight_link: { kind: "url", url: "https://example.com", label: " " },
      strip_note: "a".repeat(81),
      strip_note_link: { kind: "url", url: "https://example.com", label: "" },
    } as HeaderBarSection
    const found = sectionProblems(section)
    expect(found["search_placeholder"]).toBe("tooLong")
    expect(found["highlight_link"]).toBe("linkLabel")
    expect(found["strip_note"]).toBe("tooLong")
    expect(found["strip_note_link"]).toBe("linkLabel")
  })
})
