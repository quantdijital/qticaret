import { render, screen, within } from "@testing-library/react"
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
 * adr/0067 step 2: the storefront draws the shadow's `none` step
 * (`shadow.css`), so the field is open in the theme panel's surfaces group
 * and in its search, unmocked.
 */
describe("the shadow in the theme panel (adr/0067 S2)", () => {
  it("is ready: the storefront draws both steps", () => {
    expect(STYLE_KIT_READY.shadow).toBe(true)
  })

  it("shows in the surfaces group at today's step, and is found by its name and term", async () => {
    const onChange = vi.fn()
    render(
      <ThemeChoices theme={THEME} variants={standard} reveal={() => null} onChange={onChange} />
    )
    const surfaces = within(screen.getByRole("group", { name: "Yüzeyler" }))
    const box = surfaces.getByRole("combobox", { name: "Gölge" })
    expect(box).toHaveTextContent("Açılır katmanlarda")
    expect(box).toHaveAttribute("id", "theme-shadow")
    expect(surfaces.getByText("shadow").tagName).toBe("SMALL")
    expect(found("gölge")).toEqual(["shadow"])
    expect(found("shadow")).toContain("shadow")

    const user = userEvent.setup()
    await user.click(box)
    await user.click(await screen.findByRole("option", { name: "Yok" }))
    expect(onChange).toHaveBeenLastCalledWith({ ...THEME, shadow: "none" })
  })

  it("says which surfaces lose the shadow and which get a rule instead", () => {
    const hint = t("storefront.editor.theme.styleKit.shadow.hint")
    expect(hint).toContain("açılır menü")
    expect(hint).toContain("kenarı olmayan")
    expect(hint).not.toContain("üst bilgi")
  })
})
