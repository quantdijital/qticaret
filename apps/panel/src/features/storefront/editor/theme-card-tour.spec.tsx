import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { NO_FLAGS } from "@/features/storefront/layout/sections"
import type { CardVariant } from "@qticaret/types"
import { searchTheme } from "./settings-search"
import { SectionFlagsContext } from "./section-flags"
import { ThemeCardGroups } from "./theme-card-fields"

/**
 * adr/0077 Ek "tur kartı": the tour card's settings in the theme panel,
 * each where it means something: the words' place and the arrow on a
 * standard card, the stars' pill while the stars are shown, a dated
 * card's length and "kişi başı" only while the shop sells dated products.
 */

const THEME: ThemeSettings = { ...GRAFIT_THEME, settings_version: 2, theme: "atolye" }
const standard: ReadonlySet<CardVariant> = new Set(["standard"])
const t = (key: string) => i18next.t(key)

function draw(theme = THEME, flags: readonly string[] = [], variants = standard) {
  const onChange = vi.fn<(theme: ThemeSettings) => void>()
  render(
    <SectionFlagsContext.Provider value={{ ...NO_FLAGS, on: new Set(flags) }}>
      <ThemeCardGroups theme={theme} variants={variants} reveal={() => null} onChange={onChange} />
    </SectionFlagsContext.Provider>
  )
  return onChange
}

const withCard = (card: Partial<ThemeSettings["product_card"]>): ThemeSettings => ({
  ...THEME,
  product_card: { ...THEME.product_card, ...card },
})

describe("the theme panel's tour card settings", () => {
  it("offers the words' place and the arrow on a standard card, the dated two not without the flag", () => {
    draw()
    expect(screen.getByText("Yazının yeri")).toBeInTheDocument()
    expect(screen.getByText("Tur kartı")).toBeInTheDocument()
    expect(screen.getByLabelText("Kartın sağ altında ok göster")).not.toBeChecked()
    expect(screen.queryByLabelText("Tur süresini göster")).toBeNull()
    expect(screen.queryByLabelText(/kişi başı/)).toBeNull()
    // The stars' pill only while the stars are shown
    expect(screen.queryByLabelText("Puanı görselde rozet olarak göster")).toBeNull()
  })

  it("offers a dated card's length and 'kişi başı' while the shop sells dated products", () => {
    const onChange = draw(THEME, ["catalog.booking"])
    fireEvent.click(screen.getByLabelText("Tur süresini göster"))
    expect(onChange).toHaveBeenLastCalledWith(withCard({ duration_row: true }))
    fireEvent.click(screen.getByLabelText('Fiyatın yanına "kişi başı" yaz'))
    expect(onChange).toHaveBeenLastCalledWith(withCard({ per_person: true }))
  })

  it("saves the stars' pill and the arrow, and hides the arrow over the photo", () => {
    const onChange = draw(withCard({ show_rating: true }))
    fireEvent.click(screen.getByLabelText("Puanı görselde rozet olarak göster"))
    expect(onChange).toHaveBeenLastCalledWith(withCard({ show_rating: true, rating_badge: true }))
    fireEvent.click(screen.getByLabelText("Kartın sağ altında ok göster"))
    expect(onChange).toHaveBeenLastCalledWith(withCard({ show_rating: true, arrow: true }))
  })

  it("leaves the words' place and the arrow out where no card is standard", () => {
    draw(withCard({ text_position: "over" }), [], new Set(["framed"]))
    expect(screen.queryByText("Yazının yeri")).toBeNull()
    expect(screen.queryByLabelText("Kartın sağ altında ok göster")).toBeNull()
    expect(screen.queryByText("Tur kartı")).toBeNull()
  })

  it("finds them in the settings search by their words, a dated card's only with the flag", () => {
    const keys = (query: string, flags: readonly string[] = []) =>
      searchTheme(query, THEME, standard, t, new Set(flags)).map((hit) => hit.field.key)
    expect(keys("üstünde")).toEqual(["product_card.text_position"])
    expect(keys("kişi başı")).not.toContain("product_card.per_person")
    expect(keys("tur süresi")).not.toContain("product_card.duration_row")
    expect(keys("kişi başı", ["catalog.booking"])).toContain("product_card.per_person")
    expect(keys("tur süresi", ["catalog.booking"])).toContain("product_card.duration_row")
  })
})
