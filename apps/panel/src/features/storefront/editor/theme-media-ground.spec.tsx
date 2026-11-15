import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { CardVariant } from "@qticaret/types"
import { searchTheme } from "./settings-search"
import { STYLE_KIT_READY } from "./forms/style-kit-ready"
import { ThemeChoices } from "./theme-choices"

const THEME: ThemeSettings = { settings_version: 2, theme: "atolye", ...GRAFIT_THEME }
const standard: ReadonlySet<CardVariant> = new Set(["standard"])
const t = (key: string) => i18next.t(key)
const found = (query: string) => searchTheme(query, THEME, standard, t).map((hit) => hit.field.key)

/**
 * adr/0067 step 5: the storefront draws the photo ground (`media.css`), so
 * the field is open in the theme panel and its search, unmocked.
 */
describe("the photo ground in the theme panel (adr/0067 S4)", () => {
  it("is ready: the storefront draws both steps", () => {
    expect(STYLE_KIT_READY.media_ground).toBe(true)
  })

  it("shows in the surfaces group at today's step, and is found by its name and term", async () => {
    const onChange = vi.fn()
    render(
      <ThemeChoices theme={THEME} variants={standard} reveal={() => null} onChange={onChange} />
    )
    const box = screen.getByRole("combobox", { name: "Fotoğraf zemini" })
    expect(box).toHaveTextContent("Hafif ton")
    expect(box).toHaveAttribute("id", "theme-media-ground")
    expect(screen.getByText("image background").tagName).toBe("SMALL")
    expect(found("fotoğraf zemini")).toContain("media_ground")
    expect(found("image background")).toContain("media_ground")

    const user = userEvent.setup()
    await user.click(box)
    await user.click(await screen.findByRole("option", { name: "Sayfa" }))
    expect(onChange).toHaveBeenLastCalledWith({ ...THEME, media_ground: "page" })
  })
})
