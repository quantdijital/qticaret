import {
  ATOLYE_SECTION_SCALE,
  ATOLYE_TONES,
  TONE_SURFACES,
  atolyeTheme,
} from "@qticaret/theme-atolye"
import type { StoreThemeSettings } from "@qticaret/types"
import { fontPreloads } from "@/app/fonts"
import { isHexColor, readableOn } from "@/lib/views/color"
import { DEFAULT_THEME, themeStyle } from "@/lib/views/theme"
import type { ThemeEntry } from "./entry"

/** What a pointed-at mark is mixed with: the ink `readableOn` writes with. */
const INK = "#111113"

/**
 * What the theme prints on its own tokens for the shop's settings
 * (adr/0062 §5, §11), beside the contract's variables every theme takes:
 *
 * - a page tone other than Grafit's steel: its surface family
 *   (`ATOLYE_TONES`), over `--color-paper` and the tokens that go with it;
 * - an accent: the mark a selected chip and a count are filled with, the
 *   text that reads on it and its pointed-at shade. With no accent those
 *   are graphite, the theme's own, though the contract's `--highlight`
 *   falls back to the main colour;
 * - a section spacing other than `normal`: the factor on its section gaps
 *   (`ATOLYE_SECTION_SCALE`, `--section-scale`).
 *
 * Nothing at the defaults; every value is from a fixed list or a checked colour.
 */
export function atolyeDeclarations(settings: StoreThemeSettings): string[] {
  const { accent, background } = settings.colors
  const declarations: string[] = []
  if (background !== DEFAULT_THEME.colors.background) {
    const tone = ATOLYE_TONES[background]
    declarations.push(...TONE_SURFACES.map((surface) => `--color-${surface}:${tone[surface]}`))
  }
  if (isHexColor(accent)) {
    declarations.push(
      `--color-mark:${accent}`,
      `--color-mark-ink:${readableOn(accent)}`,
      `--color-mark-deep:color-mix(in oklab,${accent} 85%,${INK})`
    )
  }
  const scale = ATOLYE_SECTION_SCALE[settings.section_spacing]
  if (scale) {
    declarations.push(`--section-scale:${scale}`)
  }
  return declarations
}

/**
 * Atölye takes every theme setting (adr/0062 §1): the saved settings as
 * they are, the chosen faces preloaded, and its own tokens for the page
 * tone and the accent. At the defaults (Grafit) it prints nothing.
 */
export const entry: ThemeEntry = {
  theme: atolyeTheme,
  fontPreloads,
  style: (settings) => themeStyle(settings, atolyeDeclarations(settings)),
}
