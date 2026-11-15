import { describe, expect, it } from "vitest"
import { MARQUEE_SETTINGS, SCROLLER_SETTINGS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"

/** The kits' two-step settings, "off" and "on": each drawn as a switch. */
const switches = (prefix: string, settings: Readonly<Record<string, readonly string[]>>) =>
  Object.entries(settings)
    .filter(([, steps]) => steps.length === 2 && steps.includes("off") && steps.includes("on"))
    .map(([setting]) => `${prefix}.${setting}`)

const SWITCHES = [
  ...switches("storefront.editor.scroller", SCROLLER_SETTINGS),
  ...switches("storefront.editor.marquee", MARQUEE_SETTINGS),
]

/** docs/tema/bilesen-standardi §3 "Aç/kapat", denetim O7: one face for every on/off setting. */
describe("the on/off settings' names", () => {
  it("covers the scroller's and the strip's switches", () => {
    expect(SWITCHES).toEqual(
      expect.arrayContaining([
        "storefront.editor.scroller.dots",
        "storefront.editor.scroller.loop",
        "storefront.editor.marquee.hover_pause",
        "storefront.editor.marquee.closable",
      ])
    )
  })

  it.each([
    ["tr", "Kapalı", "Açık"],
    ["en", "Off", "On"],
  ])("names their steps the same way in %s, never hide and show", (lng, off, on) => {
    for (const key of SWITCHES) {
      expect(i18next.t(`${key}.off`, { lng }), key).toBe(off)
      expect(i18next.t(`${key}.on`, { lng }), key).toBe(on)
    }
  })

  it("names the dots as a sentence that says what turns on", () => {
    expect(i18next.t("storefront.editor.scroller.dots.label")).toBe("Noktaları göster")
    // One idea, one name: the slider turns on the scroller kit's own fields (bilesen-denetimi (b) 4)
    expect(i18next.exists("storefront.editor.slider.autoplay")).toBe(false)
    expect(i18next.exists("storefront.editor.slider.dots")).toBe(false)
  })
})
