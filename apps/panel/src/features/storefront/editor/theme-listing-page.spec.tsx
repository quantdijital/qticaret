import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { CardVariant } from "@qticaret/types"
import { searchTheme } from "./settings-search"
import { ListingPageGroup } from "./theme-listing-page-fields"

const THEME: ThemeSettings = { settings_version: 2, theme: "atolye", ...GRAFIT_THEME }
const standard: ReadonlySet<CardVariant> = new Set(["standard"])
const t = (key: string) => i18next.t(key)
const found = (query: string) => searchTheme(query, THEME, standard, t).map((hit) => hit.field.key)

const SWITCH = "Ziyaretçi görünümü değiştirebilsin"
const CRUMB = "Yol izinde sayfanın kendi adı"
const PLACE = "Yol izi başlıkla aynı satırda"

/** A listing page's layout: one shop-wide group of the theme, today's page by default. */
describe("Liste sayfası in the theme panel", () => {
  it("shows today's page: a grid, no switch, the trail to the page itself", () => {
    render(<ListingPageGroup theme={THEME} reveal={null} onChange={vi.fn()} />)

    expect(screen.getByText("Liste sayfası")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Varsayılan görünüm" })).toHaveTextContent("Izgara")
    expect(screen.getByRole("switch", { name: SWITCH })).not.toBeChecked()
    expect(screen.getByRole("switch", { name: CRUMB })).toBeChecked()
    expect(screen.getByRole("switch", { name: PLACE })).not.toBeChecked()
  })

  it("reads a draft from before the group at its defaults", () => {
    const old = { ...THEME, listing_page: undefined } as unknown as ThemeSettings
    render(<ListingPageGroup theme={old} reveal={null} onChange={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: "Varsayılan görünüm" })).toHaveTextContent("Izgara")
  })

  it("puts each choice in the draft's theme", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ListingPageGroup theme={THEME} reveal={null} onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Varsayılan görünüm" }))
    await user.click(await screen.findByRole("option", { name: "Liste" }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, default_view: "list" },
    })

    await user.click(screen.getByRole("switch", { name: SWITCH }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, view_switch: "show" },
    })

    await user.click(screen.getByRole("switch", { name: CRUMB }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, breadcrumb_current: "hide" },
    })

    await user.click(screen.getByRole("switch", { name: PLACE }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, crumbs_place: "beside" },
    })
  })

  it("puts the count's word in the draft, an empty one as none", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ListingPageGroup theme={THEME} reveal={null} onChange={onChange} />)
    const box = screen.getByRole("textbox", { name: "Ürün sayısında birim kelimesi" })
    expect(box).toHaveValue("")

    await user.type(box, "t")
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, count_word: "t" },
    })
    await user.type(box, " ")
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, count_word: null },
    })
    expect(found("birim")).toContain("listing_page.count_word")
  })

  it("puts the all-products title in the draft, an empty one as none", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ListingPageGroup theme={THEME} reveal={null} onChange={onChange} />)
    const box = screen.getByRole("textbox", { name: "Tüm ürünler başlığı" })
    expect(box).toHaveValue("")

    await user.type(box, "T")
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, all_title: "T" },
    })
    await user.type(box, " ")
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_page: { ...THEME.listing_page, all_title: null },
    })
    expect(found("başlık")).toContain("listing_page.all_title")
  })

  it("is found by the settings search", () => {
    expect(found("liste")).toContain("listing_page.default_view")
    expect(found("breadcrumb")).toContain("listing_page.breadcrumb_current")
    expect(found("breadcrumb")).toContain("listing_page.crumbs_place")
    expect(found("görünüm")).toEqual(
      expect.arrayContaining([
        "listing_page.default_view",
        "listing_page.view_switch",
        "listing_page.breadcrumb_current",
      ])
    )
  })
})
