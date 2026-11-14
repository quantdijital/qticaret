import type { ScrollerSetting, ScrollerSettings } from "@qticaret/types"

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

/** Whether the row offers the setting as it stands: the arrows' look with arrows, the speed when it turns. */
export function scrollerOffers(settings: ScrollerSettings, setting: ScrollerSetting): boolean {
  if (setting === "arrow_style" || setting === "arrow_position") {
    return settings.arrows !== "hidden"
  }
  return setting !== "speed" || settings.autoplay === "on"
}
