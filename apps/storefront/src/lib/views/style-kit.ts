import { STYLE_KIT, STYLE_KIT_DEFAULTS, STYLE_KIT_FIELDS } from "@qticaret/types/style-kit"
import type { StyleKit } from "@qticaret/types/style-kit"

/**
 * The style kit's fields of `GET /store/storefront`'s `theme` (adr/0067
 * §1), each a step on its list or its default: a field missing (a backend
 * before the kit) or off the list reads as today's drawing. The theme marks
 * a step off the default on its root element (`styleKitAttributes`).
 */
export function styleKitOf(raw: unknown): StyleKit {
  const theme = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const kit: Record<string, string> = {}
  for (const field of STYLE_KIT_FIELDS) {
    const steps: readonly unknown[] = STYLE_KIT[field]
    const step = theme[field]
    kit[field] = steps.includes(step) ? (step as string) : STYLE_KIT_DEFAULTS[field]
  }
  return kit as StyleKit
}

/** The kit as the theme's view carries it. */
export const styleKitView = (settings: StyleKit): StyleKit => ({
  menu_style: settings.menu_style,
  shadow: settings.shadow,
  chip_style: settings.chip_style,
  media_ground: settings.media_ground,
  density: settings.density,
  motion: settings.motion,
})
