import type { ScrollerSetting, ScrollerSettings, SliderSetting } from "@qticaret/types"

/**
 * The scroller kit's settings by where the panel shows them (adr/0049 Ek
 * 2026-11-15): what is in view and the arrows open in "Kaydırma", the dots,
 * turning by itself, looping and dragging closed in "Diğer ayarlar".
 */
export const SCROLLER_MAIN: readonly ScrollerSetting[] = [
  "desktop",
  "mobile",
  "arrows",
  "arrow_style",
  "arrow_position",
]
export const SCROLLER_OTHER: readonly ScrollerSetting[] = [
  "dots",
  "autoplay",
  "speed",
  "loop",
  "drag",
]

/**
 * The sliding opening's kit settings by where the panel shows them
 * (bilesen-denetimi (b) 4, 1.3): what the controls do in "Kaydırma"
 * (turning by itself, its speed and pause button, the arrows, the dots),
 * how they look in their own group under it ("Ok ve nokta görünümü":
 * the arrows' shape and size, the dots' style and place, the ground),
 * looping closed in "Diğer ayarlar".
 */
export const SLIDER_MAIN: readonly SliderSetting[] = [
  "autoplay",
  "speed",
  "play_button",
  "arrows",
  "dots",
]
export const SLIDER_LOOK: readonly SliderSetting[] = [
  "arrow_style",
  "arrow_size",
  "dot_style",
  "controls_place",
  "controls_tone",
]
export const SLIDER_OTHER: readonly SliderSetting[] = ["loop"]

/**
 * Whether the row offers the setting as it stands: the arrows' look with
 * arrows, the speed and the pause button when it turns, the dots' style
 * with dots, their place while the pill under the slides shows (dots or
 * the pause button), the ground while something has one.
 */
export function scrollerOffers(settings: ScrollerSettings, setting: ScrollerSetting): boolean {
  const arrows = settings.arrows !== "hidden"
  const pill = settings.dots === "on" || settings.autoplay === "on"
  switch (setting) {
    case "arrow_style":
    case "arrow_position":
    case "arrow_size":
      return arrows
    case "speed":
    case "play_button":
      return settings.autoplay === "on"
    case "dot_style":
      return settings.dots === "on"
    case "controls_place":
      return pill
    case "controls_tone":
      return (arrows && settings.arrow_style !== "plain") || pill
    case "desktop":
    case "mobile":
    case "arrows":
    case "dots":
    case "autoplay":
    case "loop":
    case "drag":
      return true
  }
}
