import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { CardVariant } from "@qticaret/types"
import { searchTheme } from "./settings-search"
import { ListingTextGroup } from "./theme-listing-text-fields"

const THEME: ThemeSettings = { settings_version: 2, theme: "atolye", ...GRAFIT_THEME }
const standard: ReadonlySet<CardVariant> = new Set(["standard"])
const t = (key: string) => i18next.t(key)
const found = (query: string) => searchTheme(query, THEME, standard, t).map((hit) => hit.field.key)

/** The listing pages' text at their foot (adr/0075 §6): one shop-wide group of the theme. */
describe("Liste metni in the theme panel (adr/0075)", () => {
  it("shows the defaults: normal size, from the start, narrow, folded", () => {
    render(<ListingTextGroup theme={THEME} reveal={null} onChange={vi.fn()} />)

    expect(screen.getByText("Liste metni")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Yazı boyu" })).toHaveTextContent("Normal")
    expect(screen.getByRole("combobox", { name: "Hizalama" })).toHaveTextContent("Sola yaslı")
    expect(screen.getByRole("combobox", { name: "Genişlik" })).toHaveTextContent("Dar")
    expect(
      screen.getByRole("switch", { name: "Uzun metni 'Devamını oku' ile katla" })
    ).toBeChecked()
  })

  it("reads a draft from before the group at its defaults", () => {
    const old = { ...THEME, listing_text: undefined } as unknown as ThemeSettings
    render(<ListingTextGroup theme={old} reveal={null} onChange={vi.fn()} />)
    expect(screen.getByRole("combobox", { name: "Yazı boyu" })).toHaveTextContent("Normal")
  })

  it("puts each choice in the draft's theme", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ListingTextGroup theme={THEME} reveal={null} onChange={onChange} />)

    await user.click(screen.getByRole("combobox", { name: "Yazı boyu" }))
    await user.click(await screen.findByRole("option", { name: "Büyük" }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_text: { ...THEME.listing_text, size: "lg" },
    })

    await user.click(screen.getByRole("switch", { name: "Uzun metni 'Devamını oku' ile katla" }))
    expect(onChange).toHaveBeenLastCalledWith({
      ...THEME,
      listing_text: { ...THEME.listing_text, collapse: false },
    })
  })

  it("is found by the settings search", () => {
    expect(found("yazı boyu")).toContain("listing_text.size")
    expect(found("ortalı")).toContain("listing_text.align")
    expect(found("devamını oku")).toContain("listing_text.collapse")
    expect(found("açıklama")).toEqual(
      expect.arrayContaining([
        "listing_text.size",
        "listing_text.align",
        "listing_text.width",
        "listing_text.collapse",
      ])
    )
  })
})
