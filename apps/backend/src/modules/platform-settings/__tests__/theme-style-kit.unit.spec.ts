import path from "node:path"
import { layoutTheme, shownTheme, storedTheme } from "../../../lib/storefront/layout-theme"
import { presetTheme } from "../../../lib/storefront/presets/document"
import { mergePatch } from "../sections/define"
import { parseStored } from "../sections/stored"
import { STYLE_KIT, STYLE_KIT_DEFAULTS, themeSection, withCardDefaults } from "../sections/theme"

const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/style-kit.ts"
)

const { full, patch, defaults } = themeSection

const saved = (body: Record<string, unknown>) => full.safeParse(mergePatch(defaults, body))

/** The theme without the kit's fields: a design's theme or a preset written before adr/0067. */
const beforeKit = (): Record<string, unknown> =>
  Object.fromEntries(Object.entries(defaults).filter(([key]) => !Object.hasOwn(STYLE_KIT, key)))

/** adr/0067 §1: the style kit's four new steps, each a theme setting. */
describe("theme section: the style kit", () => {
  it("holds the contract's lists, today's drawing first and the default", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(STYLE_KIT).toEqual(contract["STYLE_KIT"])
    expect(STYLE_KIT_DEFAULTS).toEqual(contract["STYLE_KIT_DEFAULTS"])
    expect(defaults).toMatchObject({
      menu_style: "filled",
      shadow: "float",
      chip_style: "filled",
      media_ground: "well",
    })
    for (const [field, steps] of Object.entries(STYLE_KIT)) {
      expect(defaults[field as keyof typeof STYLE_KIT]).toBe(steps[0])
    }
  })

  it("takes every step on its list, a patch of one keeping the others", () => {
    for (const [field, steps] of Object.entries(STYLE_KIT)) {
      for (const step of steps) {
        expect(saved({ [field]: step }).success).toBe(true)
      }
    }
    expect(full.parse(mergePatch(defaults, patch.parse({ menu_style: "plain" })))).toEqual({
      ...defaults,
      menu_style: "plain",
    })
  })

  it.each([
    ["a menu style off the list", { menu_style: "boxed" }],
    ["a shadow off the list", { shadow: "deep" }],
    ["a shadow as CSS", { shadow: "0 4px 8px #000" }],
    ["a chip style off the list", { chip_style: "glass" }],
    ["a photo ground as a colour", { media_ground: "#ffffff" }],
    ["a step that is not a string", { chip_style: 1 }],
    ["no step", { media_ground: null }],
  ])("refuses %s", (_, body) => {
    expect(saved(body).success).toBe(false)
  })

  it("reads a settings row stored before the kit at today's drawing", () => {
    expect(parseStored("theme", beforeKit())).toEqual(defaults)
    const chosen = { ...beforeKit(), shadow: "none" }
    expect(parseStored("theme", chosen)).toEqual({ ...defaults, shadow: "none" })
  })

  it("reads a design's theme or a preset written before the kit at today's drawing", () => {
    expect(withCardDefaults(beforeKit())).toEqual(defaults)
    expect(withCardDefaults({ ...beforeKit(), chip_style: "lined" })).toEqual({
      ...defaults,
      chip_style: "lined",
    })
    expect(layoutTheme.parse(storedTheme(beforeKit()))).toEqual(defaults)
    expect(presetTheme(beforeKit())).toEqual(defaults)
    // A step off the list is kept for the schema to refuse, as any other field's
    expect(withCardDefaults({ ...beforeKit(), media_ground: "dark" })).toMatchObject({
      media_ground: "dark",
    })
    expect(() => presetTheme({ ...beforeKit(), media_ground: "dark" })).toThrow()
  })

  it("serves the kit to the storefront with the rest of the theme", () => {
    const theme = { ...defaults, menu_style: "underline", media_ground: "page" } as const
    expect(shownTheme(theme, defaults, null)).toMatchObject({
      menu_style: "underline",
      shadow: "float",
      chip_style: "filled",
      media_ground: "page",
    })
    expect(shownTheme(null, theme, null)).toMatchObject({ menu_style: "underline" })
  })
})
