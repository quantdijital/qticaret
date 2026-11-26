import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import { GRAFIT_THEME } from "@/features/storefront/api/theme"
import type { ThemeSettings } from "@/features/storefront/api/theme"
import type { CardVariant } from "@qticaret/types"
import { searchTheme } from "./settings-search"
import { THEME_FIELDS } from "./forms/theme-registry"
import { ThemeChoices } from "./theme-choices"

// Which kit fields the storefront draws: none in the contract's PR; a test turns them on
const ready = vi.hoisted(() => ({
  menu_style: false,
  shadow: false,
  chip_style: false,
  media_ground: false,
  density: false,
  motion: false,
}))
vi.mock("./forms/style-kit-ready", () => ({ STYLE_KIT_READY: ready }))

const THEME: ThemeSettings = { settings_version: 2, theme: "atolye", ...GRAFIT_THEME }
const standard: ReadonlySet<CardVariant> = new Set(["standard"])
const t = (key: string) => i18next.t(key)
const found = (query: string) => searchTheme(query, THEME, standard, t).map((hit) => hit.field.key)

function draw(onChange = vi.fn()) {
  render(<ThemeChoices theme={THEME} variants={standard} reveal={() => null} onChange={onChange} />)
  return onChange
}

/** A group's choices, by their names, in the panel's order. */
const choicesIn = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("combobox")
    .map((box) => box.getAttribute("id"))

const KIT_NAMES = ["Menü stili", "Gölge", "Çip stili", "Fotoğraf zemini", "Yoğunluk", "Hareket"]

afterEach(() => {
  Object.assign(ready, {
    menu_style: false,
    shadow: false,
    chip_style: false,
    media_ground: false,
    density: false,
    motion: false,
  })
})

/** adr/0067 §1, §2.7: the style kit in the theme panel. */
describe("the style kit in the theme panel", () => {
  it("splits corners and buttons into shapes, the room into spacing, the rest into surfaces (§2.7, Ek 2026-11-16)", () => {
    expect(THEME_FIELDS.filter((f) => f.group === "shapes").map((f) => f.key)).toEqual([
      "radius",
      "buttons",
      "chip_style",
    ])
    expect(THEME_FIELDS.filter((f) => f.group === "spacing").map((f) => f.key)).toEqual([
      "section_spacing",
      "density",
      "page_width",
    ])
    expect(THEME_FIELDS.filter((f) => f.group === "surfaces").map((f) => f.key)).toEqual([
      "surface_style",
      "shadow",
      "media_ground",
      "menu_style",
      "motion",
    ])
    // The panel's order: colours, faces, shapes, spacing, surfaces, the card, the listing
    // text, the search box
    expect([...new Set(THEME_FIELDS.map((f) => f.group))]).toEqual([
      "colors",
      "fonts",
      "shapes",
      "spacing",
      "surfaces",
      "card",
      "framed",
      "listingText",
      "listingPage",
      "searchForm",
    ])
  })

  it("hides every kit field from the form and the search until the storefront draws it", () => {
    draw()
    expect(screen.getByRole("group", { name: "Şekiller" })).toBeVisible()
    expect(choicesIn("Şekiller")).toEqual(["theme-radius", "theme-buttons"])
    expect(choicesIn("Boşluklar")).toEqual(["theme-section-spacing"])
    expect(choicesIn("Yüzeyler")).toEqual(["theme-surface-style"])
    for (const name of KIT_NAMES) {
      expect(screen.queryByRole("combobox", { name })).toBeNull()
    }
    expect(found("gölge")).toEqual([])
    expect(found("menü stili")).toEqual([])
    expect(found("image background")).toEqual([])
    // Their words are written already, for the step that draws them
    for (const field of THEME_FIELDS.filter((f) => f.key in ready)) {
      expect(i18next.exists(field.label), field.label).toBe(true)
      expect(i18next.exists(field.label.replace(/label$/, "hint"))).toBe(true)
    }
  })

  it("shows a field once its step turns it on, in its group's place, its term small", async () => {
    Object.assign(ready, {
      menu_style: true,
      shadow: true,
      chip_style: true,
      media_ground: true,
      density: true,
      motion: true,
    })
    const onChange = draw()
    expect(choicesIn("Şekiller")).toEqual(["theme-radius", "theme-buttons", "theme-chip-style"])
    expect(choicesIn("Boşluklar")).toEqual(["theme-section-spacing", "theme-density"])
    expect(choicesIn("Yüzeyler")).toEqual([
      "theme-surface-style",
      "theme-shadow",
      "theme-media-ground",
      "theme-menu-style",
      "theme-motion",
    ])
    expect(screen.getByRole("combobox", { name: "Menü stili" })).toHaveTextContent("Dolu")
    expect(screen.getByRole("combobox", { name: "Yoğunluk" })).toHaveTextContent("Ferah")
    expect(screen.getByRole("combobox", { name: "Gölge" })).toHaveTextContent("Açılır katmanlarda")
    expect(screen.getByRole("combobox", { name: "Fotoğraf zemini" })).toHaveTextContent("Hafif ton")
    expect(screen.getByText("menu items").tagName).toBe("SMALL")
    expect(found("gölge")).toEqual(["shadow"])

    const user = userEvent.setup()
    await user.click(screen.getByRole("combobox", { name: "Menü stili" }))
    await user.click(await screen.findByRole("option", { name: "Sade" }))
    expect(onChange).toHaveBeenLastCalledWith({ ...THEME, menu_style: "plain" })

    // adr/0067 Ek 2026-11-16: the density's three steps, airy first
    await user.click(screen.getByRole("combobox", { name: "Yoğunluk" }))
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Ferah",
      "Dengeli",
      "Sıkı",
    ])
    await user.click(screen.getByRole("option", { name: "Dengeli" }))
    expect(onChange).toHaveBeenLastCalledWith({ ...THEME, density: "balanced" })
  })

  it("offers the motion in the surfaces, calm first, and hands the form lively (adr/0067 Ek 2026-11-18)", async () => {
    ready.motion = true
    const onChange = draw()
    const motion = screen.getByRole("combobox", { name: "Hareket" })
    expect(motion).toHaveTextContent("Sakin")
    expect(choicesIn("Yüzeyler").at(-1)).toBe("theme-motion")
    expect(found("hareket")).toEqual(["motion"])
    expect(found("canlı")).toEqual(["motion"])

    const user = userEvent.setup()
    await user.click(motion)
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Sakin",
      "Canlı",
    ])
    await user.click(screen.getByRole("option", { name: "Canlı" }))
    expect(onChange).toHaveBeenLastCalledWith({ ...THEME, motion: "lively" })
  })

  it("finds the spacing by the words a shop owner uses for it (owner 2026-11-16)", () => {
    ready.density = true
    for (const word of ["boşluk", "bosluk", "aralık", "sıkı", "ferah", "yoğunluk"]) {
      expect(found(word), word).toEqual(["section_spacing", "density"])
    }
    expect(found("bölüm aralığı")).toEqual(["section_spacing"])
    expect(found("dengeli")).toEqual(["density"])
    expect(found("çok sık")).toEqual(["section_spacing"])
  })

  it("turns on one field alone", () => {
    ready.shadow = true
    draw()
    expect(screen.getByRole("combobox", { name: "Gölge" })).toBeVisible()
    expect(screen.queryByRole("combobox", { name: "Çip stili" })).toBeNull()
  })
})
