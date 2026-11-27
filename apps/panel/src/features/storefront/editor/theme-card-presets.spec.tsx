import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import { NO_FLAGS } from "@/features/storefront/layout/sections"
import type { CardVariant } from "@qticaret/types"
import { SectionFlagsContext } from "./section-flags"
import { ThemeCardGroups } from "./theme-card-fields"
import { CARD_PRESET_VALUES, cardPresetOf } from "./card-presets"

/**
 * sahip 2026-11-26: the ready-made card looks over the card's settings,
 * and the two settings they need (the details on the photo, the frosted
 * panel), today's card by default.
 */

const THEME: ThemeSettings = { ...GRAFIT_THEME, settings_version: 2, theme: "atolye" }
const standard: ReadonlySet<CardVariant> = new Set(["standard"])

function draw(theme = THEME, variants = standard) {
  const onChange = vi.fn<(theme: ThemeSettings) => void>()
  render(
    <SectionFlagsContext.Provider value={{ ...NO_FLAGS, on: new Set<string>() }}>
      <ThemeCardGroups theme={theme} variants={variants} reveal={() => null} onChange={onChange} />
    </SectionFlagsContext.Provider>
  )
  return onChange
}

const withCard = (card: Partial<ThemeSettings["product_card"]>): ThemeSettings => ({
  ...THEME,
  product_card: { ...THEME.product_card, ...card },
})

describe("the theme panel's ready-made card looks", () => {
  it("reads today's card as custom and each look's values as that look", () => {
    expect(cardPresetOf(THEME.product_card)).toBeNull()
    for (const preset of ["classic", "modern", "glass"] as const) {
      expect(cardPresetOf({ ...THEME.product_card, ...CARD_PRESET_VALUES[preset] })).toBe(preset)
    }
    // Modern with the name and price inside the photo is still Modern
    expect(
      cardPresetOf({ ...THEME.product_card, ...CARD_PRESET_VALUES.modern, text_position: "over" })
    ).toBe("modern")
    expect(
      cardPresetOf({ ...THEME.product_card, ...CARD_PRESET_VALUES.glass, hover_cycle: false })
    ).toBeNull()
  })

  it("fills a look's settings in when picked and shows the matching one chosen", () => {
    const onChange = draw()
    expect(screen.getByText("Özel")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Cam panel" }))
    expect(onChange).toHaveBeenLastCalledWith(withCard(CARD_PRESET_VALUES.glass))
  })

  it("marks the look the settings match", () => {
    draw(withCard(CARD_PRESET_VALUES.modern))
    expect(screen.getByRole("radio", { name: "Modern" })).toBeChecked()
    expect(screen.queryByText("Özel")).toBeNull()
    expect(screen.getByText("Puan, tarih ve süre")).toBeInTheDocument()
    expect(screen.getByText("Kart stili")).toBeInTheDocument()
  })

  it("leaves the looks and their settings out without a standard card", () => {
    draw(THEME, new Set(["framed"]))
    expect(screen.queryByText("Hazır kart görünümü")).toBeNull()
    expect(screen.queryByText("Kart stili")).toBeNull()
  })
})
