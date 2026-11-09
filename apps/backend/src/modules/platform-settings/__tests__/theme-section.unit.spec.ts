import { mergePatch } from "../sections/define"
import { THEME_BACKGROUNDS, primaryReadable, themeSection } from "../sections/theme"

const { full, patch, defaults } = themeSection

const saved = (body: Record<string, unknown>) => full.safeParse(mergePatch(defaults, body))
const issueOf = (body: Record<string, unknown>) => saved(body).error?.issues[0]

describe("theme section", () => {
  it("starts as today's look, and its defaults pass its own checks", () => {
    expect(defaults).toEqual({
      theme: "atolye",
      colors: { primary: null, accent: null, background: "warm" },
      typography: { heading: "fraunces", body: "inter" },
      radius: "soft",
      product_card: { ratio: "4:5", show_brand: true, show_rating: false },
      header: { layout: "centered", sticky: true },
      buttons: "pill",
    })
    expect(full.safeParse(defaults).success).toBe(true)
    // The first theme's page colour, still the panel's contrast check's
    expect(THEME_BACKGROUNDS.warm).toBe("#f6f4ef")
  })

  it("reads a section stored with the removed first theme as Atölye (adr/0057 Ek 2026-11-09)", () => {
    expect(full.parse(mergePatch(defaults, { theme: "base" })).theme).toBe("atolye")
    expect(patch.parse({ theme: "base" })).toEqual({ theme: "atolye" })
  })

  it("takes the shop's choices, a colour in lower case", () => {
    const parsed = full.parse(
      mergePatch(defaults, {
        colors: { primary: " #0B5C99 ", accent: "#B42318", background: "cool" },
        typography: { heading: "playfair", body: "nunito" },
        radius: "round",
        product_card: { ratio: "1:1", show_brand: false, show_rating: true },
        header: { layout: "left", sticky: false },
        buttons: "square",
      })
    )

    expect(parsed.colors).toEqual({ primary: "#0b5c99", accent: "#b42318", background: "cool" })
    expect(parsed.typography).toEqual({ heading: "playfair", body: "nunito" })
  })

  it("keeps a nested group's other fields when the panel sends one", () => {
    const body = patch.parse({ colors: { primary: "#1a1814" } })
    const merged = full.parse(mergePatch(defaults, body))
    expect(merged.colors).toEqual({ primary: "#1a1814", accent: null, background: "warm" })
  })

  it.each([
    ["an unknown theme", { theme: "dawn" }],
    ["a font that is not ours", { typography: { heading: "comic-sans", body: "inter" } }],
    ["a font address", { typography: { heading: "https://fonts.example/x.woff2", body: "inter" } }],
    ["a colour name", { colors: { primary: "red", accent: null, background: "warm" } }],
    ["a short colour", { colors: { primary: "#fff", accent: null, background: "warm" } }],
    ["an unknown page colour", { colors: { primary: null, accent: null, background: "pink" } }],
    ["a card shape", { product_card: { ratio: "16:9", show_brand: true, show_rating: false } }],
    ["a button shape", { buttons: "blob" }],
    ["CSS of its own", { css: "body{display:none}" }],
  ])("refuses %s", (_, body) => {
    expect(saved(body).success).toBe(false)
  })

  it("refuses a main colour white text or the page cannot carry (WCAG AA large, 3:1)", () => {
    // Pale yellow: 1.1:1 on white
    const pale = issueOf({ colors: { primary: "#fde68a", accent: null, background: "warm" } })
    expect(pale?.message).toBe("platform_settings.color_contrast")
    expect(pale?.path).toEqual(["colors", "primary"])
    // #949494 reaches 3:1 on white, not on the warm page
    expect(primaryReadable("#949494", "warm")).toBe(false)
    expect(
      issueOf({ colors: { primary: "#949494", accent: null, background: "warm" } })?.message
    ).toBe("platform_settings.color_contrast")
    // Dark enough for both
    for (const background of ["warm", "neutral", "cool"] as const) {
      expect(saved({ colors: { primary: "#2f6feb", accent: null, background } }).success).toBe(true)
      expect(primaryReadable("#1a1814", background)).toBe(true)
    }
  })

  it("checks the colour against the page it is saved with", () => {
    // #8e8e8e: 3.28:1 on white; 3.005:1 on the neutral page, 2.98 on the warm, 2.9996 on the cool
    const colors = (background: string) => ({ primary: "#8e8e8e", accent: null, background })
    expect(saved({ colors: colors("neutral") }).success).toBe(true)
    expect(saved({ colors: colors("warm") }).success).toBe(false)
    expect(saved({ colors: colors("cool") }).success).toBe(false)
  })
})
