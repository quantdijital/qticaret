import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import type { HeaderBarSection } from "@/features/storefront/api/layout"
import {
  HEADER_CATALOG_DEFAULTS,
  isUnbuilt,
  switchVariant,
} from "@/features/storefront/layout/variants"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { searchSettings } from "../settings-search"
import { headerCatalogIn } from "./field-registry"
import { HeaderBarForm } from "./header-bar-form"
import { HeaderCatalogOther } from "./header-catalog-other"

const standard: HeaderBarSection = {
  id: "mainheader",
  type: "header_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "standard",
  sticky: true,
  menu_images: "submenus",
}

/** The bar's open content and its closed "Diğer ayarlar", every change kept. */
function renderBar(section: HeaderBarSection) {
  const changes: HeaderBarSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    const keep = (next: HeaderBarSection) => {
      changes.push(next)
      setValue(next)
    }
    return (
      <>
        <HeaderBarForm section={value} problems={{}} onChange={keep} />
        {value.variant === "catalog" ? (
          <HeaderCatalogOther section={value} problems={{}} reveal={null} onChange={keep} />
        ) : null}
      </>
    )
  }
  render(<Holder />)
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

  it("puts the basics first and open, the finer ones closed", () => {
    expect(headerCatalogIn("content")).toEqual([
      "search_placeholder",
      "search_width",
      "utility_bar",
      "top_links",
      "phone",
      "tools_place",
      "categories_button",
      "menu_ground",
      "highlight_link",
    ])
    expect(headerCatalogIn("look")).toEqual(["search_label", "account_text", "cart_total"])
  })

  it("offers the three layout choices, each starting at today's drawing", async () => {
    const changes = renderBar(switchVariant(standard, "catalog"))
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
    await userEvent.click(
      within(choice(/Arama kutusunun genişliği/)).getByRole("radio", { name: "Dar" })
    )
    expect(changes.at(-1)).toMatchObject({ search_width: "narrow" })
    await userEvent.click(
      within(choice(/Üst menü bağlantılarının yeri/)).getByRole("radio", { name: "Menü çubuğunda" })
    )
    expect(changes.at(-1)).toMatchObject({ top_links: "bar" })
    // Off the default, it offers the way back
    const width = document.getElementById("mainheader-header-search_width")
    expect(width).not.toBeNull()
    await userEvent.click(within(width!).getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ search_width: "wide" })
  })

  it("hides what the tools in the logo row leave without a job", async () => {
    const changes = renderBar(switchVariant(standard, "catalog"))
    await userEvent.click(screen.getByRole("button", { name: /Diğer ayarlar/ }))
    expect(screen.getByRole("switch", { name: /Üst şeritte “Hesabım” yazısı/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: "Logo satırında" }))
    expect(changes.at(-1)).toMatchObject({ tools_place: "row" })
    // The row carries "Hesabım": the strip's written one is no longer offered
    expect(screen.queryByRole("switch", { name: /Üst şeritte “Hesabım” yazısı/ })).toBeNull()
    expect(screen.getByRole("switch", { name: /Üst yardımcı şerit/ })).toBeInTheDocument()
    // With the top links on the bar too, the strip has nothing left to hold
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: /Üst menü bağlantılarının yeri/ })).getByRole(
        "radio",
        { name: "Menü çubuğunda" }
      )
    )
    expect(screen.queryByRole("switch", { name: /Üst yardımcı şerit/ })).toBeNull()
  })

  it("shows today's bar only its pictures' steps and sticky switch", () => {
    renderBar(standard)
    expect(screen.getByRole("switch", { name: /Üst bilgi sabit kalsın/ })).toBeInTheDocument()
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
    const changes = renderBar(standard)
    await userEvent.click(screen.getByRole("radio", { name: "Yok" }))
    expect(changes.at(-1)).toMatchObject({
      variant: "standard",
      menu_images: "off",
    })
    await userEvent.click(screen.getByRole("radio", { name: "Her yerde" }))
    expect(changes.at(-1)).toMatchObject({ menu_images: "all" })
    await userEvent.click(screen.getByRole("button", { name: /Varsayılana dön/ }))
    expect(changes.at(-1)).toMatchObject({ menu_images: "submenus" })
  })

  it("puts the pictures' steps right under the catalog's Kategoriler button, kept across variants", async () => {
    const catalog = switchVariant({ ...standard, menu_images: "all" }, "catalog")
    expect(catalog).toMatchObject({ menu_images: "all" })
    expect(switchVariant(catalog, "centered")).toMatchObject({
      menu_images: "all",
    })
    const changes = renderBar(catalog)
    const order = [
      ...document.querySelectorAll("#mainheader-header-categories_button, #mainheader-menu-images"),
    ].map((each) => each.id)
    expect(order).toEqual(["mainheader-header-categories_button", "mainheader-menu-images"])
    expect(screen.getByRole("radio", { name: "Her yerde" })).toBeChecked()
    await userEvent.click(screen.getByRole("radio", { name: "Alt menülerde" }))
    expect(changes.at(-1)).toMatchObject({
      variant: "catalog",
      menu_images: "submenus",
    })
  })
  it("changes what the catalog bar shows, its ground and words", async () => {
    const changes = renderBar(switchVariant(standard, "catalog"))
    await userEvent.click(screen.getByRole("switch", { name: /Telefon numarası/ }))
    expect(changes.at(-1)).toMatchObject({ phone: false })
    await userEvent.click(screen.getByRole("radio", { name: "Ana renk" }))
    expect(changes.at(-1)).toMatchObject({ menu_ground: "primary" })
    await userEvent.type(screen.getByLabelText(/Arama kutusundaki yazı/), "Kod ara")
    expect(changes.at(-1)).toMatchObject({ search_placeholder: "Kod ara" })
    await userEvent.clear(screen.getByLabelText(/Arama kutusundaki yazı/))
    expect(changes.at(-1)).toMatchObject({ search_placeholder: null })
    // The closed group opens to its three switches, its title counting what was set
    await userEvent.click(screen.getByRole("button", { name: /Diğer ayarlar/ }))
    await userEvent.click(screen.getByRole("switch", { name: /Sepette tutarı göster/ }))
    expect(changes.at(-1)).toMatchObject({ cart_total: true })
    expect(screen.getByRole("button", { name: /Diğer ayarlar · 1 ayar/ })).toBeInTheDocument()
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
    } as HeaderBarSection
    const found = sectionProblems(section)
    expect(found["search_placeholder"]).toBe("tooLong")
    expect(found["highlight_link"]).toBe("linkLabel")
  })
})
