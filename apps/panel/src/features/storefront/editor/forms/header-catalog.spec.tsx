import { render, screen } from "@testing-library/react"
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
      "utility_bar",
      "phone",
      "categories_button",
      "menu_ground",
      "highlight_link",
    ])
    expect(headerCatalogIn("look")).toEqual(["search_label", "account_text", "cart_total"])
  })

  it("shows today's bar only its sticky switch", () => {
    renderBar(standard)
    expect(screen.getByRole("switch", { name: /Üst bilgi sabit kalsın/ })).toBeInTheDocument()
    expect(screen.queryByText(/Menü çubuğu zemini/)).toBeNull()
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
    expect(keys("tutar")).toContain("header.cart_total")
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
